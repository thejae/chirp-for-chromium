import { initializeSentry } from './helpers/sentry-helpers'

// Local variables -------------------------------------------------------------
let audioElement = new Audio()
let shouldPlay = false
let audioContext: AudioContext | null = null

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
      if (!audioUri) reject('No audioUri provided')

      shouldPlay = true

      audioElement.src = audioUri
      audioElement.onloadedmetadata = function () {
        if (!shouldPlay) {
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
          .catch((e) => reject('Error while trying to play audio'))
      }

      audioElement.onerror = function () {
        reject(`Error loading audio source: ${audioUri}`)
      }

      audioElement.onended = function () {
        resolve(`Finished playing`)
      }
    })
  },
  stop: function () {
    return new Promise((resolve) => {
      shouldPlay = false

      if (!audioElement.paused) {
        audioElement.pause()
        audioElement.currentTime = 0

        resolve('Stopped audio')
        return
      }

      resolve('No audio is currently playing')
    })
  },
}
