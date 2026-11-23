import { describe, expect, test } from 'bun:test'
import {
  isSSMLText,
  splitLongSentence,
  synthesizeInput,
} from '../extension/helpers/text-helpers.js'

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

  test(
    'preserves native sentence-final punctuation and clause commas for prosody',
    () => {
      // Regression: every native terminal mark was collapsed to an ASCII
      // period and every native comma to a spaced ASCII comma, flattening
      // questions/exclamations into statements and adding a fake beat after
      // each comma. The exact marks must reach the TTS engine intact.
      expect(splitLongSentence('你好，世界！')).toEqual(['你好，世界！'])
      expect(splitLongSentence('今天天气怎么样？')).toEqual([
        '今天天气怎么样？',
      ])
      expect(splitLongSentence('太好了！')).toEqual(['太好了！'])
      expect(splitLongSentence('首先，其次，最后。')).toEqual([
        '首先，其次，最后。',
      ])
      expect(splitLongSentence('Wait, what?! Really!')).toEqual([
        'Wait, what?!',
        'Really!',
      ])
    },
  )

  test(
    'keeps native commas tight and converts only decorative brackets',
    () => {
      // Regression: normalizeTextForTts inserted a space after every comma,
      // splitting "1,000" into two spoken numbers. Commas inside a chunk must
      // stay attached to the following character; CJK enumeration (、) stays
      // native where the engine understands it.
      expect(splitLongSentence('It cost 1,000 dollars today')).toEqual([
        'It cost 1,000 dollars today.',
      ])
      expect(splitLongSentence('苹果、香蕉和橙子')).toEqual(['苹果、香蕉和橙子。'])
      expect(splitLongSentence('「你好」')).toEqual(['你好。'])
    },
  )

  test(
    'keeps consecutive native marks with the sentence they finish',
    () => {
      // "？！" is a normal emphatic question in Chinese. Splitting between the
      // two marks would send a bare "！" to TTS as its own chunk.
      expect(splitLongSentence('真的吗？！你说什么？！')).toEqual([
        '真的吗？！',
        '你说什么？！',
      ])
    },
  )

  test(
    'never emits a bare run of punctuation as its own chunk',
    () => {
      // Regression: the pre-split in chunk() cut after every single terminal
      // mark, so "？？" became ["真的吗？", "？"]; the bare "？" was then
      // read aloud literally as "question mark". Repeated marks are emphatic
      // punctuation, not standalone text, and Intl.Segmenter already keeps a
      // run like "？？" or "!!!" with the sentence it ends.
      expect('真的吗？？'.chunk()).toEqual(['真的吗？？'])
      expect('太好了！！！'.chunk()).toEqual(['太好了！！！'])
      expect('What??'.chunk()).toEqual(['What??'])
      expect('Really!!!'.chunk()).toEqual(['Really!!!'])
      expect('真的吗？！'.chunk()).toEqual(['真的吗？！'])
      expect('What? Really?'.chunk()).toEqual(['What?', 'Really?'])
    },
  )
})

describe('SSML input', () => {
  const pastedSsml =
    '\n  <speak xml:lang="en-US">Hello <break time="1s"/>world</speak>\n'

  test('detects SSML with attributes and surrounding whitespace', () => {
    expect(isSSMLText(pastedSsml)).toBe(true)
    expect(isSSMLText('<speak>Hello</speak>')).toBe(true)
  })

  test('does not treat plain text or a markup fragment as SSML', () => {
    expect(isSSMLText('<speak>Hello</speak> and more')).toBe(false)
    expect(isSSMLText('Hello <break time="1s"/>')).toBe(false)
    expect(isSSMLText('')).toBe(false)
  })

  test('sends SSML to the API in ssml, exactly as entered apart from outer whitespace', () => {
    const input = synthesizeInput(pastedSsml)
    expect(input).toEqual({ ssml: pastedSsml.trim() })

    const body = JSON.stringify({ input })
    expect(body).toContain('"ssml"')
    expect(body).not.toContain('"text"')
  })

  test('keeps plain text in the text field', () => {
    expect(synthesizeInput('Hello world')).toEqual({ text: 'Hello world' })
  })

  test('chunk() leaves pasted SSML byte-for-byte intact when it fits one request', () => {
    const chunks = pastedSsml.chunk()
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(pastedSsml.trim())
    expect(synthesizeInput(chunks[0])).toEqual({ ssml: pastedSsml.trim() })
  })

  test('long SSML splits into complete documents that keep the original opening tag', () => {
    const openTag = '<speak xml:lang="en-US">'
    const inner = Array.from(
      { length: 200 },
      (_, i) => `<p>Line ${i}: a short sentence.</p>`,
    ).join('')
    const ssml = `${openTag}${inner}</speak>`

    const chunks = ssml.chunk()
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.startsWith(openTag)).toBe(true)
      expect(chunk.endsWith('</speak>')).toBe(true)
      expect(chunk.length).toBeLessThanOrEqual(5000)
      expect(synthesizeInput(chunk)).toHaveProperty('ssml')
    }
    expect(
      chunks
        .map((chunk) => chunk.slice(openTag.length, -'</speak>'.length))
        .join(''),
    ).toBe(inner)
  })
})
