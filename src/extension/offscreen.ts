import { initializeSentry } from './helpers/sentry-helpers'

// Local variables -------------------------------------------------------------
let audioElement = new Audio()
let shouldPlay = false
let audioContext: AudioContext | null = null
let currentPlayResolver: ((value: any) => void) | null = null

// Bootstrap -------------------------------------------------------------------
initializeSentry()

/**
 * Decodes a data URI's audio buffer to obtain the exact duration in seconds
 * when `HTMLAudioElement.duration` reports `Infinity` (common for streaming
 * `OGG_OPUS` responses from Google Cloud TTS).
 */
async function resolveAudioDuration(
  audioUri: string,
  elementDuration: number,
): Promise<number> {
  if (Number.isFinite(elementDuration) && elementDuration > 0) {
    return elementDuration
  }
  try {
    const response = await fetch(audioUri)
    const arrayBuffer = await response.arrayBuffer()
    if (!audioContext) {
      audioContext = new AudioContext()
    }
    const decoded = await audioContext.decodeAudioData(arrayBuffer)
    if (Number.isFinite(decoded.duration) && decoded.duration > 0) {
      return decoded.duration
    }
  } catch {
    // Fallback handled by content script if decoding fails
  }
  return 0
}

// Event listeners -------------------------------------------------------------
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (!request) return

  const { id, payload, offscreen } = request
  if (!offscreen) return

  if (!handlers[id]) throw new Error(`No handler for ${id}`)
  handlers[id](payload).then(sendResponse)

  return true
})

// Handlers --------------------------------------------------------------------
const handlers = {
  play: function ({ audioUri }) {
    return new Promise((resolve, reject) => {
      if (!audioUri) return reject('No audioUri provided')

      shouldPlay = true
      currentPlayResolver = resolve

      audioElement.src = audioUri
      audioElement.onloadedmetadata = function () {
        if (!shouldPlay) {
          currentPlayResolver = null
          resolve('Playback was stopped before audio could start')
          return
        }

        const rawDuration = audioElement.duration
        audioElement
          .play()
          .then(async () => {
            const duration = await resolveAudioDuration(audioUri, rawDuration)
            chrome.runtime
              .sendMessage({
                id: 'chunkPlaybackStarted',
                payload: { duration },
              })
              .catch(() => {})
          })
          .catch((e) => {
            currentPlayResolver = null
            reject('Error while trying to play audio')
          })
      }

      audioElement.onerror = function () {
        currentPlayResolver = null
        reject(`Error loading audio source: ${audioUri}`)
      }

      audioElement.onended = function () {
        currentPlayResolver = null
        resolve(`Finished playing`)
      }
    })
  },
  pause: function () {
    return new Promise((resolve) => {
      shouldPlay = false
      if (!audioElement.paused) {
        audioElement.pause()
        resolve('Paused audio')
        return
      }
      resolve('Audio was already paused')
    })
  },
  resume: function () {
    return new Promise((resolve, reject) => {
      shouldPlay = true
      if (audioElement.src && audioElement.paused && !audioElement.ended) {
        audioElement
          .play()
          .then(() => resolve('Resumed audio'))
          .catch(() => reject('Error while trying to resume audio'))
        return
      }
      resolve('Audio was not in a paused state')
    })
  },
  getPlaybackTime: function () {
    return Promise.resolve({
      currentTime: audioElement.currentTime || 0,
      duration: audioElement.duration || 0,
      paused: audioElement.paused,
      ended: audioElement.ended,
    })
  },
  stop: function () {
    return new Promise((resolve) => {
      shouldPlay = false
      const wasPlaying = !audioElement.paused
      audioElement.pause()
      audioElement.currentTime = 0
      audioElement.src = ''

      if (currentPlayResolver) {
        currentPlayResolver('Stopped audio')
        currentPlayResolver = null
      }

      resolve(wasPlaying ? 'Stopped audio' : 'No audio is currently playing')
    })
  },
}
