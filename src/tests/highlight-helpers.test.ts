import { describe, expect, test } from 'bun:test'
import { matchChunkWords } from '../extension/helpers/highlight-helpers.js'

describe('matchChunkWords', () => {
  const domText =
    'Once upon a time, in a distant kingdom, the dragon slept beneath a bridge'

  test(
    'every matched span points back at the word it claims',
    () => {
      const { timings } = matchChunkWords('Once upon a time, in a', domText, 0)
      expect(timings.length).toBe(6)

      for (const timing of timings) {
        expect(
          domText.slice(timing.startIndex, timing.endIndex)
        ).toBe(timing.word)
      }
    },
  )

  test(
    'timing ratios run from zero to one without gaps',
    () => {
      const { timings } = matchChunkWords(
        'Once upon a time, in a distant kingdom,',
        domText,
        0,
      )
      expect(timings[0].startRatio).toBe(0)
      expect(timings[timings.length - 1].endRatio).toBe(1)

      for (let i = 1; i < timings.length; i++) {
        expect(timings[i].startRatio).toBe(timings[i - 1].endRatio)
        expect(timings[i].endRatio).toBeGreaterThan(timings[i].startRatio)
      }
    },
  )

  test(
    'resumes from the cursor instead of restarting the search',
    () => {
      const first = matchChunkWords('Once upon a time,', domText, 0)
      const second = matchChunkWords(
        'in a distant kingdom,',
        domText,
        first.nextCursor,
      )

      // Words already emitted must not be matched a second time: the second
      // chunk starts after the first one finished.
      expect(second.timings[0].startIndex).toBeGreaterThan(
        first.nextCursor - 1,
      )
      expect(
        domText.slice(second.timings[0].startIndex, second.timings[0].endIndex)
      ).toBe(second.timings[0].word)
    },
  )

  test(
    'survives words that are absent from the page text',
    () => {
      const { timings } = matchChunkWords(
        'Mermaids sang beneath the bridge',
        domText,
        0,
      )
      const words = timings.map((t) => t.word)
      expect(words.includes('Mermaids')).toBe(false)
      expect(words.includes('bridge')).toBe(true)
    },
  )
})
