/**
 * Maps Google Cloud Text-to-Speech audio encoding enum values to file
 * extensions used when downloading synthesized audio.
 */
export const fileExtMap = {
  MP3: 'mp3',
  MP3_64_KBPS: 'mp3',
  OGG_OPUS: 'ogg',
  LINEAR16: 'wav',
  PCM: 'wav',
}

/**
 * Merges base64-encoded audio chunks returned by Google Cloud TTS into a
 * single base64 audio payload.
 *
 * For WAV/PCM (`LINEAR16` / `PCM`) streams with a 44-byte RIFF/WAVE header,
 * strips duplicate WAV headers from subsequent chunks and updates the RIFF
 * and `data` chunk byte-length fields in the initial header so players play
 * the entire merged file rather than stopping after the first chunk.
 */
export function mergeAudioChunks(
  audioContents: string[],
  encoding: string,
): string {
  const decodedChunks = audioContents.map((b64) => atob(b64))
  if (decodedChunks.length <= 1) {
    return audioContents[0] || ''
  }

  const isWavLike =
    (encoding === 'LINEAR16' || encoding === 'PCM') &&
    decodedChunks[0].startsWith('RIFF')

  if (!isWavLike) {
    return btoa(decodedChunks.join(''))
  }

  const WAV_HEADER_SIZE = 44
  const pcmPayloads = decodedChunks.map((chunk) =>
    chunk.startsWith('RIFF') && chunk.length > WAV_HEADER_SIZE
      ? chunk.slice(WAV_HEADER_SIZE)
      : chunk,
  )
  const totalPcmLength = pcmPayloads.reduce((sum, p) => sum + p.length, 0)

  const headerBytes = new Uint8Array(WAV_HEADER_SIZE)
  for (let i = 0; i < WAV_HEADER_SIZE; i++) {
    headerBytes[i] = decodedChunks[0].charCodeAt(i)
  }

  const view = new DataView(headerBytes.buffer)
  view.setUint32(4, 36 + totalPcmLength, true)
  view.setUint32(40, totalPcmLength, true)

  let updatedHeader = ''
  for (let i = 0; i < WAV_HEADER_SIZE; i++) {
    updatedHeader += String.fromCharCode(headerBytes[i])
  }

  return btoa(updatedHeader + pcmPayloads.join(''))
}
