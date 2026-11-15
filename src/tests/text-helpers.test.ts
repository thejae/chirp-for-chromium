import { describe, expect, test } from 'bun:test'
import { splitLongSentence } from '../extension/helpers/text-helpers.js'

// Mirrors the limits inside text-helpers.js: the clause budget enforced
// before the terminating punctuation is appended.
const MAX_SENTENCE_CHARS = 80
const MAX_CJK_SENTENCE_CHARS = 35

describe('splitLongSentence', () => {
  test(
    'returns nothing for empty input',
    () => expect(splitLongSentence('   ')).toEqual([] as string[]),
  )

  test(
    'keeps short sentences whole and terminates them',
    () =>
      expect(splitLongSentence('The dragon slept')).toEqual([
        'The dragon slept.',
      ] as string[]),
  )

  test(
    'splits a long sentence into clauses that stay under the TTS limit',
    () => {
      const sentence =
        'The World Health Organization published a practical guide that speaks plainly, ' +
        'for everyone from health professionals to parents and caregivers, ' +
        'because plain language reaches more people than technical wording does'

      const pieces = splitLongSentence(sentence)
      expect(pieces.length).toBeGreaterThan(1)
      for (const piece of pieces) {
        expect(piece.length).toBeLessThanOrEqual(MAX_SENTENCE_CHARS + 1)
      }

      // Reassembly must reproduce the original wording exactly: a piece that
      // carried over already-emitted text (the bug this guards) shows up here
      // as duplicated words, and a piece dropped at a hard slice as missing
      // ones. Clause punctuation is normalized away on both sides because the
      // splitter terminates each piece with its own full stop.
      const stripClausePunctuation = (text: string) =>
        text
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => word.replace(/[.,:;!?—]+$/, ''))
          .join(' ')
      const original = stripClausePunctuation(sentence)
      const reassembled = stripClausePunctuation(pieces.join(' '))
      expect(reassembled).toBe(original)
    },
  )

  test(
    'uses the shorter CJK limit so a long run-on CJK clause never reaches the API',
    () => {
      const cjk =
        '全球 health 组织（WHO）发布了一个全新的 practical guide 面向 everyone ' +
        '从 health professionals 到 parents caregivers，因为 simple 语言 是 better 因为 technical wording 面向 everyone，' +
        'because plain language reaches more people than technical wording does，' +
        'including teachers parents 和 caregivers around the world who read about health topics'

      const pieces = splitLongSentence(cjk)
      const longest = pieces.reduce((max, p) => Math.max(max, p.length), 0)
      expect(longest).toBeLessThanOrEqual(MAX_CJK_SENTENCE_CHARS + 1)
      expect(pieces.length).toBeGreaterThan(1)
    },
  )

  test(
    'does not repeat a clause when a hard cut lands exactly on the limit',
    () => {
      // 160 chars: an exact multiple of the 80-char latin limit, so the hard
      // slice finishes flush and the accumulator must not be reused.
      const longClause = 'delta '.repeat(20) + 'z'.repeat(40)
      const sentence = 'alpha beta gamma, ' + longClause

      const pieces = splitLongSentence(sentence)
      expect(pieces.length).toBe(3)

      // The bug this guards emitted a fourth piece that duplicated the
      // accumulator from the previous pass.
      const unique = new Set(pieces)
      expect(unique.size).toBe(pieces.length)

      for (const piece of pieces) {
        // The terminator added by ensureTerminalPunctuation may push a
        // full-width clause one character past the limit.
        expect(piece.length).toBeLessThanOrEqual(MAX_SENTENCE_CHARS + 1)
      }
    },
  )

  test(
    'chunk() breaks real page text at boundaries the API accepts',
    () => {
      const text =
        'Dr. Smith arrived at 3.14 p.m. near the U.S. border. He said: "Leave now!" ' +
        'The WHO (World Health Organization) issued guidance - plain, practical, ' +
        'and clear - for everyone.'

      const pieces = text.chunk()
      expect(pieces.length).toBe(7)
      for (const piece of pieces) {
        expect(piece.length).toBeLessThanOrEqual(MAX_SENTENCE_CHARS + 1)
      }

      // Abbreviations end a sentence for the platform's ICU rules, but must
      // never swallow the clause that follows them.
      expect(pieces[0]).toBe('Dr.')
      expect(pieces.some((piece) => piece.includes('3.14 p.m.'))).toBe(true)
    },
  )
})
