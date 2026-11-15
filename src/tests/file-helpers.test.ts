import { describe, expect, test } from 'bun:test'
import { mergeAudioChunks } from '../extension/helpers/file-helpers.js'

/**
 * Builds a minimal RIFF/WAVE payload: 44-byte header followed by `pcmBytes`
 * bytes of audio, so the test can compare the sizes the merged header
 * advertises against the payload that actually ships.
 */
function buildWavChunk(pcmBytes: number): string {
  const bytes: number[] = []
  const pushAscii = (text: string) =>
    bytes.push(...Array.from(text).map((c) => c.charCodeAt(0)))
  const pushUint32LE = (value: number) => {
    for (let i = 0; i < 4; i++) bytes.push((value >>> (8 * i)) & 0xff)
  }

  const totalPcm = pcmBytes
  pushAscii('RIFF')
  pushUint32LE(36 + totalPcm)
  pushAscii('WAVE')
  pushAscii('fmt ')
  pushUint32LE(16) // fmt chunk size
  pushAscii(' '.repeat(16)) // fmt body placeholder (16 bytes)
  pushAscii('data')
  pushUint32LE(totalPcm)
  for (let i = 0; i < totalPcm; i++) bytes.push((i % 251) & 0xff)

  const raw = String.fromCharCode(...bytes)
  return btoa(raw)
}

describe('mergeAudioChunks', () => {
  const chunkOne = buildWavChunk(1000)
  const chunkTwo = buildWavChunk(742)

  test(
    'passes a single chunk through untouched',
    () => expect(mergeAudioChunks([chunkOne], 'LINEAR16')).toBe(chunkOne),
  )

  test(
    'reports the merged sizes in the header it returns',
    () => {
      const merged = mergeAudioChunks([chunkOne, chunkTwo], 'LINEAR16')
      const bytes = atob(merged)
      const view = Buffer.from(bytes, 'binary')

      expect(view.slice(0, 4).toString('ascii')).toBe('RIFF')
      expect(view.readUInt32LE(4)).toBe(36 + 1000 + 742) // RIFF chunk size
      expect(view.readUInt32LE(40)).toBe(1000 + 742) // data chunk size
    },
  )

  test(
    'keeps every audio byte instead of concatenating headers',
    () => {
      const merged = mergeAudioChunks([chunkOne, chunkTwo], 'LINEAR16')
      const mergedBytes = Buffer.from(atob(merged), 'binary')

      // One header only: exactly one "data" marker survived the merge.
      const dataMarkers =
        mergedBytes
          .toString('binary')
          .split('data')
          .filter((part, index) => index > 0).length
      expect(dataMarkers).toBe(1)
      expect(mergedBytes.length).toBe(44 + 1000 + 742)
    },
  )

  test(
    'leaves non-WAV encodings as a plain byte concat',
    () => {
      const merged = mergeAudioChunks([chunkOne, chunkTwo], 'MP3')
      const bytes = Buffer.from(atob(merged), 'binary')
      expect(bytes.length).toBe(atob(chunkOne).length + atob(chunkTwo).length)
    },
  )
})
