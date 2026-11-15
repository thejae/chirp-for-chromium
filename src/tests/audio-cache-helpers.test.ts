import { describe, expect, test } from 'bun:test'
import {
  cachedAudioStats,
  clearCachedAudio,
  getCachedAudio,
  storeCachedAudio,
} from '../extension/helpers/audio-cache-helpers.js'

const limit = cachedAudioStats().limit

// Mirrors what `synthesize` builds: the request body is the cache key, so the
// test only ever varies the fields that actually change the audio.
const requestBody = (
  text: string,
  { voice = 'en-US-Neural2-A', speed = 1, encoding = 'MP3' } = {},
) =>
  JSON.stringify({
    input: { text },
    voice: { languageCode: 'en-US', name: voice },
    audioConfig: { audioEncoding: encoding, speakingRate: speed },
  })

const oneMb = 'a'.repeat(1024 * 1024)
const threeMb = 'b'.repeat(3 * 1024 * 1024)

describe('audio cache helpers', () => {
  test(
    'the first read misses and the second one replays the same audio',
    () => {
      const body = requestBody('Once upon a time, the dragon slept')
      const audio = 'SUONcH0iZGVk'

      expect(getCachedAudio(body)).toBeUndefined()
      storeCachedAudio(body, audio)
      expect(getCachedAudio(body)).toBe(audio)
    },
  )

  test(
    'a different voice, speed or encoding misses',
    () => {
      const plain = requestBody('The same sentence again')
      storeCachedAudio(plain, 'cG1vZW9')

      expect(
        getCachedAudio(requestBody('The same sentence again', { voice: 'en-GB-RyanNeural' })),
      ).toBeUndefined()
      expect(
        getCachedAudio(requestBody('The same sentence again', { speed: 1.4 })),
      ).toBeUndefined()
      expect(
        getCachedAudio(requestBody('The same sentence again', { encoding: 'OGG_OPUS' })),
      ).toBeUndefined()
    },
  )

  test(
    'a response without audio never enters the cache',
    () => {
      const body = requestBody('This one failed to synthesize')

      storeCachedAudio(body, '')
      storeCachedAudio(body, undefined)
      expect(getCachedAudio(body)).toBeUndefined()
    },
  )

  test(
    're-synthesizing a chunk replaces its entry instead of double counting it',
    () => {
      const body = requestBody('Counted once whatever it costs')
      const before = cachedAudioStats()

      storeCachedAudio(body, oneMb)
      storeCachedAudio(body, 'c')

      const after = cachedAudioStats()
      expect(after.entries - before.entries).toBe(1)
      expect(after.chars - before.chars).toBe(1)
    },
  )

  test(
    'an oversized response is skipped rather than clearing the cache',
    () => {
      const before = cachedAudioStats()
      const body = requestBody('Bigger than the whole budget')

      storeCachedAudio(body, 'x'.repeat(limit + 1))
      expect(getCachedAudio(body)).toBeUndefined()
      expect(cachedAudioStats()).toEqual(before)
    },
  )

  test(
    'the budget drops the least recently heard clips first',
    () => {
      const first = requestBody('Heard first and longest forgotten')
      const middle = requestBody('Heard in the middle')
      const last = requestBody('Heard most recently')

      storeCachedAudio(first, threeMb)
      storeCachedAudio(middle, threeMb)
      getCachedAudio(first)
      storeCachedAudio(last, threeMb)

      expect(cachedAudioStats().chars).toBe(limit)
      expect(getCachedAudio(middle)).toBeUndefined()
      expect(getCachedAudio(first)).toBeDefined()
      expect(getCachedAudio(last)).toBeDefined()
    },
  )

  test(
    'the byte counter never drifts away from the entries it claims',
    () => {
      const stats = cachedAudioStats()
      expect(stats.entries).toBeLessThanOrEqual(3)
      expect(stats.chars).toBeLessThanOrEqual(stats.limit)
      expect(stats.entries === 0).toBe(stats.chars === 0)
    },
  )

  test(
    'clearing empties the cache and reports what it dropped',
    () => {
      const body = requestBody('Heard once more before dropping')
      storeCachedAudio(body, oneMb)
      const before = cachedAudioStats()

      const dropped = clearCachedAudio()
      expect(dropped.entries).toBeGreaterThan(0)
      expect(dropped.entries).toBe(before.entries)
      expect(dropped.chars).toBe(before.chars)

      const after = cachedAudioStats()
      expect(after.entries).toBe(0)
      expect(after.chars).toBe(0)
      expect(getCachedAudio(body)).toBeUndefined()
    },
  )
})
