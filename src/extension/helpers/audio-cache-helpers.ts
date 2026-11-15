/**
 * Google bills every `text:synthesize` request by the characters it is sent, so
 * reading the same passage a second time used to pay a second time for audio
 * that is byte-for-byte identical. These helpers hold the responses for the
 * rest of the browsing session: the service worker is torn down when the
 * browser closes or the extension reloads, which empties the map along with it.
 *
 * Entries are keyed by the exact request body the API is about to receive, which
 * already carries the input text or SSML, the resolved voice and language
 * (including the Mandarin substitution for CJK), the audio encoding, speed,
 * pitch, gain and effects profile. Changing any of those produces a different
 * key, so a stale clip can never be replayed for a different voice.
 */
const cachedAudio = new Map<string, string>()
let cachedAudioChars = 0

// Base64 sentences run to a few hundred KB each, so the budget holds a whole
// article's playback without holding the extension's memory footprint hostage.
const CACHED_AUDIO_LIMIT = 6 * 1024 * 1024

/**
 * Returns audio synthesized earlier for the identical request body, marking it
 * as the most recently used entry, or nothing when this is a first request.
 */
export function getCachedAudio(requestBody: string) {
  const audioContent = cachedAudio.get(requestBody)
  if (audioContent === undefined) return undefined

  cachedAudio.delete(requestBody)
  cachedAudio.set(requestBody, audioContent)
  return audioContent
}

/**
 * Keeps a synthesized chunk for the rest of the session, dropping the least
 * recently used entries until the byte budget has room. A single response
 * larger than the whole budget is never kept, because storing it would evict
 * everything else the moment it lands.
 */
export function storeCachedAudio(requestBody: string, audioContent: string) {
  if (typeof audioContent !== 'string' || !audioContent.length) return
  if (audioContent.length > CACHED_AUDIO_LIMIT) return

  cachedAudioChars -= cachedAudio.get(requestBody)?.length || 0
  cachedAudio.delete(requestBody)

  while (
    cachedAudioChars + audioContent.length > CACHED_AUDIO_LIMIT &&
    cachedAudio.size
  ) {
    const oldestEntry = cachedAudio.entries().next().value
    if (!oldestEntry) break

    const [, oldestAudio] = oldestEntry
    cachedAudioChars -= oldestAudio.length
    cachedAudio.delete(oldestEntry[0])
  }

  cachedAudio.set(requestBody, audioContent)
  cachedAudioChars += audioContent.length
}

/**
 * Drops everything the session has synthesized so far, and reports what was
 * dropped. Freeing the memory this way costs nothing, but the next read of the
 * same text pays the API again, so it is the escape hatch for anyone who wants
 * a fresh voice, a fresh take, or simply less memory held open.
 */
export function clearCachedAudio() {
  const stats = cachedAudioStats()

  cachedAudio.clear()
  cachedAudioChars = 0
  return stats
}

/**
 * Reports what the cache is currently holding, for tests and for anyone
 * wondering how much audio a session has kept.
 */
export function cachedAudioStats() {
  return { entries: cachedAudio.size, chars: cachedAudioChars, limit: CACHED_AUDIO_LIMIT }
}
