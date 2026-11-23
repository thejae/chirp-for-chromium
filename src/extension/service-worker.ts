import { synthesizeInput } from './helpers/text-helpers.js'
import { fileExtMap, mergeAudioChunks } from './helpers/file-helpers.js'
import { createError, isError } from './helpers/error-helpers.js'
import {
  respondWithHandlerResult,
  resolveTargetTab,
} from './helpers/message-listener-helpers.js'
import { resolveVoices } from './helpers/voice-helpers.js'
import { appendLog, clearLogs, loggedFetch } from './helpers/log-helpers.js'
import {
  clearCachedAudio,
  getCachedAudio,
  storeCachedAudio,
} from './helpers/audio-cache-helpers.js'

// Local state -----------------------------------------------------------------
let queue = []
let playing = false
let paused = false
let cancellationToken = false
let activeChunkText = ''
let totalChunks = 0
let currentChunkIndex = 0
let currentChunkDuration = 0
let chunkLengths: number[] = []
let totalChars = 0
let completedChars = 0
let highlightingEnabled = true
let sessionTabId = null
let bootstrappedResolver = null
const bootstrapped = new Promise((resolve) => (bootstrappedResolver = resolve))

async function updatePlaybackSessionState() {
  await chrome.storage.session.set({
    playing,
    paused,
    activeChunkText,
    totalChunks,
    currentChunkIndex,
    currentChunkDuration,
    totalChars,
    completedChars,
  })
}

/**
 * Ends the current playback session: clears the local state, stores it,
 * refreshes the context menus, and stops any in-page highlighting. Every exit
 * path of readAloud and stopReading must run the same reset, so it lives here.
 */
async function endPlaybackSession() {
  if (!playing) return
  playing = false
  paused = false
  totalChunks = 0
  currentChunkIndex = 0
  currentChunkDuration = 0
  activeChunkText = ''
  chunkLengths = []
  totalChars = 0
  completedChars = 0
  await updatePlaybackSessionState()
  await updateContextMenus()
  if (highlightingEnabled) {
    await sendMessageToCurrentTab({ id: 'highlightSessionEnd' })
  }
  sessionTabId = null
}

// Bootstrap -------------------------------------------------------------------
(async function Bootstrap() {
  await setDefaultSettings()
  await appendLog('INFO', 'Service worker bootstrapping…')
  try {
    await handlers.fetchVoices()
  } catch (e: any) {
    await appendLog('WARN', 'Initial voice fetch failed during bootstrap', e?.message)
  }
  await createContextMenus()
  bootstrappedResolver()
  await appendLog('INFO', 'Service worker bootstrap complete')
})()

// Event listeners -------------------------------------------------------------
chrome.commands.onCommand.addListener(function (command) {
  console.log('Handling command...', command)
  appendLog('INFO', `Keyboard shortcut triggered: ${command}`)

  if (!handlers[command]) throw new Error(`No handler found for ${command}`)

  handlers[command]()
})

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log('Handling message...', request, sender, sendResponse)

  const { id, payload, offscreen } = request
  if (offscreen) return

  if (!handlers[id]) throw new Error(`No handler found for ${id}`)
  if (
    id !== 'clearLogs' &&
    id !== 'chunkPlaybackStarted' &&
    id !== 'clearAudioCache'
  ) {
    appendLog('INFO', `Runtime message received: ${id}`, payload)
  }
  respondWithHandlerResult(handlers, id, payload, sendResponse)

  return true
})

chrome.storage.onChanged.addListener(async function (changes) {
  console.log('Handling storage change...', changes)

  if (changes.downloadEncoding) {
    await updateContextMenus()
  }
})

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  console.log('Handling context menu click...', info, tab)

  const id = info.menuItemId
  const payload = { text: info.selectionText }
  appendLog('INFO', `Context menu clicked: ${String(id)}`, {
    selectionLength: info.selectionText?.length || 0,
  })

  if (!handlers[id]) throw new Error(`No handler found for ${id}`)

  handlers[id](payload)
})

chrome.runtime.onInstalled.addListener(async function (details) {
  console.log('Handling runtime install...', details)

  const self = await chrome.management.getSelf()
  if (details.reason === 'update' && self.installType !== 'development') {
    chrome.tabs.create({
      url: 'https://github.com/thejae/chirp-for-chromium/blob/master/CHANGELOG.md',
    })
  }
})

// Handlers --------------------------------------------------------------------
export const handlers = {
  clearLogs: async function () {
    await clearLogs()
    return true
  },
  clearAudioCache: async function () {
    const { entries, chars } = clearCachedAudio()

    await appendLog(
      'INFO',
      entries
        ? `Dropped ${entries} cached audio clips from this session`
        : 'No cached audio held this session, so nothing to drop',
      { entries, chars },
    )

    return true
  },
  readAloud: async function ({ text, highlight = true }) {
    console.log('Reading aloud...', { text, highlight })

    if (playing) await this.stopReading()

    const chunks = text.chunk()
    console.log('Chunked text into', chunks.length, 'chunks', chunks)

    // Claim the session before the first await: a second trigger that arrives
    // while this one is still logging must see `playing` and stop this session
    // instead of pushing the same text into the shared queue a second time.
    playing = true
    paused = false

    // Remember where the selection lives before anything can switch tabs, so
    // every highlight message in this session goes back to the same page.
    const [sourceTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    sessionTabId = sourceTab?.id ?? null

    await appendLog(
      'INFO',
      `Reading aloud (${text.length} chars in ${chunks.length} chunk${chunks.length === 1 ? '' : 's'})`,
      { chunks },
    )

    queue.push(...chunks)
    totalChunks = chunks.length
    currentChunkIndex = 0
    currentChunkDuration = 0
    chunkLengths = chunks.map((chunk) => chunk.length)
    totalChars = chunkLengths.reduce((sum, len) => sum + len, 0)
    completedChars = 0
    activeChunkText = chunks[0] || ''
    await updatePlaybackSessionState()
    await updateContextMenus()

    let count = 0
    const sync = await chrome.storage.sync.get()
    const encoding = sync.readAloudEncoding
    // Resolve the voice pair once per session: a chunk loop would otherwise
    // re-read settings and re-index the whole voice list for every sentence.
    const voices = resolveVoices(await chrome.storage.session.get(), sync)
    highlightingEnabled =
      highlight !== false && sync.highlightSpokenWords !== false
    if (highlightingEnabled) {
      await sendMessageToCurrentTab({
        id: 'highlightSessionStart',
        payload: { text, firstChunk: chunks[0] },
      })
    }
    const prefetchQueue = []
    cancellationToken = false
    while (queue.length) {
      if (cancellationToken) {
        cancellationToken = false
        await endPlaybackSession()
        return
      }

      const text = queue.shift()
      activeChunkText = text
      currentChunkIndex = count
      completedChars = chunkLengths
        .slice(0, count)
        .reduce((sum, len) => sum + len, 0)
      await updatePlaybackSessionState()
      const nextText = queue[0]

      if (nextText) {
        prefetchQueue.push(
          this.getAudioUri({ text: nextText, encoding, voices }),
        )
      }

      try {
        const audioUri =
          count === 0
            ? await this.getAudioUri({ text, encoding, voices })
            : await prefetchQueue.shift()

        if (isError(audioUri)) {
          await endPlaybackSession()
          return audioUri
        }

        await createOffscreenDocument()
        await appendLog('INFO', `Playing audio chunk ${count + 1}`)
        const playResult = await chrome.runtime.sendMessage({
          id: 'play',
          payload: { audioUri },
          offscreen: true,
        })
        if (isError(playResult)) {
          sendMessageToCurrentTab(playResult)
          await endPlaybackSession()
          return playResult
        }
      } catch (e: any) {
        console.warn('Failed to play audio', e)
        await appendLog('WARN', 'Audio playback interrupted or failed', e?.message)
        await endPlaybackSession()

        // Audio playback may have failed because the user stopped playback, or
        // called the readAloud function again. We need to return early to avoid
        // playing the next chunk.
        return
      }

      console.log('Play through of audio complete. Enqueuing next chunk.')
      count++
    }

    await endPlaybackSession()
    await appendLog('INFO', 'Finished reading aloud all chunks')
    return Promise.resolve(true)
  },
  chunkPlaybackStarted: async function ({ duration }) {
    currentChunkDuration = duration || 0
    await updatePlaybackSessionState()
    if (!playing || !highlightingEnabled || !activeChunkText) return false
    await sendMessageToCurrentTab({
      id: 'highlightChunk',
      payload: { text: activeChunkText, duration },
    })
    return true
  },
  readAloudShortcut: async function () {
    console.log('Handling read aloud shortcut...')

    if (playing) {
      await this.stopReading()
      return true
    }

    const selection = await getActiveTabSelection()
    if (isError(selection)) return selection

    return this.readAloud({ text: selection })
  },
  autoReadOnPopupOpen: async function () {
    if (playing) return false

    const sync = await chrome.storage.sync.get()
    if (sync.autoReadAloud !== true) return false

    if (!sync.apiKey) return false

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (
        !tab?.id ||
        tab.url?.startsWith('chrome://') ||
        tab.url?.startsWith('edge://')
      ) {
        return false
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: retrieveSelection,
      })
      const text = result?.[0]?.result?.trim()
      if (!text) return false

      await appendLog(
        'INFO',
        `Auto-reading ${text.length} highlighted characters on popup open`,
      )
      return this.readAloud({ text })
    } catch {
      return false
    }
  },
  stopReading: async function () {
    console.log('Stopping reading...')
    await appendLog('INFO', 'Stopping audio playback')

    cancellationToken = true
    queue = []
    await endPlaybackSession()

    try {
      await createOffscreenDocument()
      await chrome.runtime.sendMessage({
        id: 'stop',
        offscreen: true,
      })
    } catch (e) {
      console.warn('Failed to stop audio', e)
    }

    return Promise.resolve(true)
  },
  pauseReading: async function () {
    if (!playing || paused) return false
    paused = true
    await updatePlaybackSessionState()
    try {
      await createOffscreenDocument()
      await chrome.runtime.sendMessage({
        id: 'pause',
        offscreen: true,
      })
    } catch (e) {
      console.warn('Failed to pause audio', e)
    }
    if (highlightingEnabled) {
      await sendMessageToCurrentTab({ id: 'highlightPause' })
    }
    await appendLog('INFO', 'Audio playback paused')
    return true
  },
  resumeReading: async function () {
    if (!playing || !paused) return false
    paused = false
    await updatePlaybackSessionState()
    try {
      await createOffscreenDocument()
      await chrome.runtime.sendMessage({
        id: 'resume',
        offscreen: true,
      })
    } catch (e) {
      console.warn('Failed to resume audio', e)
    }
    if (highlightingEnabled) {
      await sendMessageToCurrentTab({ id: 'highlightResume' })
    }
    await appendLog('INFO', 'Audio playback resumed')
    return true
  },
  togglePlayPause: async function () {
    if (!playing) {
      return this.readAloudShortcut()
    }
    if (paused) {
      return this.resumeReading()
    }
    return this.pauseReading()
  },
  getPlaybackTime: async function () {
    if (!playing) return { currentTime: 0, duration: 0, paused: false }
    try {
      await createOffscreenDocument()
      return await chrome.runtime.sendMessage({
        id: 'getPlaybackTime',
        offscreen: true,
      })
    } catch {
      return { currentTime: 0, duration: currentChunkDuration, paused }
    }
  },
  download: async function ({ text }) {
    console.log('Downloading audio...', { text })
    await appendLog('INFO', `Preparing audio download (${text?.length || 0} chars)`)

    const { downloadEncoding: encoding } = await chrome.storage.sync.get()

    const url = await this.getAudioUri({ text, encoding })
    if (isError(url)) return url

    console.log('Downloading audio from', url)
    const filename = `tts-download.${fileExtMap[encoding]}`
    await appendLog('INFO', `Triggering browser download: ${filename}`)

    chrome.downloads.download({
      url,
      filename,
    })

    return Promise.resolve(true)
  },
  downloadShortcut: async function () {
    console.log('Handling download shortcut...')

    const selection = await getActiveTabSelection()
    if (isError(selection)) return selection

    return this.download({ text: selection })
  },
  synthesize: async function ({ text, encoding, voices }) {
    console.log('Synthesizing text...', { text, encoding })

    const sync = await chrome.storage.sync.get()
    const key = sync.apiKey

    if (!key) {
      const error = createError({
        errorCode: 'MISSING_API_KEY',
        errorMessage: 'Missing API key',
        errorTitle:
          "Your api key is invalid or missing. Please double check it has been entered correctly inside the extension's popup.",
      })

      await appendLog('ERROR', 'Synthesis aborted: Missing API key')
      sendMessageToCurrentTab(error)

      return error
    }

    const url = `${process.env.TTS_API_URL}/text:synthesize`
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    }

    // SSML typed into the Sandbox must reach the API in `input.ssml`, exactly
    // as written; plain text stays in `input.text` and keeps the normal
    // sentence splitting. This is the only place the request body is built,
    // so Read aloud, Download and the Sandbox all go through it.
    const input = synthesizeInput(text)

    // Normalize UI encoding aliases to encodings supported across all Google Cloud TTS voices
    // (Chirp/Journey/Studio voices reject legacy MP3_64_KBPS and require MP3, OGG_OPUS, or LINEAR16).
    const apiEncoding =
      encoding === 'PCM'
        ? 'LINEAR16'
        : encoding === 'MP3_64_KBPS'
        ? 'MP3'
        : encoding

    const rawContent = input.ssml || input.text || ''
    const hasCjk = /[\u3400-\u9fff]/.test(rawContent)

    // Chunk loops hand us a pair resolved once per session; a standalone call
    // (sandbox, single-shot download) resolves it here exactly once instead.
    let resolution = voices
    if (!resolution) {
      const session = await chrome.storage.session.get()
      resolution = resolveVoices(session, sync)
    }

    // Chinese ideographs need the Mandarin voice resolved alongside the
    // configured one, because Chirp3/Journey voices reject them outright.
    const useCjkVoice = hasCjk && Boolean(resolution.cjkVoiceName)
    const voiceLanguageCode =
      useCjkVoice ? resolution.cjkLanguageCode : resolution.languageCode
    const voiceName = useCjkVoice
      ? resolution.cjkVoiceName
      : resolution.voiceName

    const buildRequestBody = (overrideVoice?: string, overrideLang?: string) =>
      JSON.stringify({
        input,
        voice: {
          languageCode: overrideLang || voiceLanguageCode,
          name: overrideVoice || voiceName,
        },
        audioConfig: {
          audioEncoding: apiEncoding,
          speakingRate: sync.speed,
          pitch: sync.pitch,
          volumeGainDb: sync.volumeGainDb,
          ...(sync.audioProfile !== 'default'
            ? { effectsProfileId: [sync.audioProfile] }
            : {}),
        },
      })

    // The request body is the whole identity of the audio: the input text or
    // SSML, the resolved voice and language (CJK substitution included), the
    // encoding, speed, pitch, gain and effects profile. An identical body
    // earlier in the session is billed zero times.
    const requestBody = buildRequestBody()
    const cachedAudio = getCachedAudio(requestBody)
    if (cachedAudio !== undefined) {
      await appendLog(
        'INFO',
        `Reusing ${rawContent.length} chars synthesized earlier this session (no API call)`,
      )
      return cachedAudio
    }

    try {
      let response = await loggedFetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
      })

      if (!response.ok) {
        console.log('Failed to synthesize text', response)
        let message = (await response.json()).error?.message

        // If a Chirp3/Journey voice rejects the chunk due to its internal token
        // limit ("sentences that are too long"), retry once with a standard
        // WaveNet voice which handles arbitrary multi-script strings cleanly.
        if (
          typeof message === 'string' &&
          message.includes('sentences that are too long')
        ) {
          const fallbackLang = hasCjk ? 'cmn-CN' : voiceLanguageCode
          const fallbackVoice = hasCjk
            ? 'cmn-CN-Wavenet-A'
            : `${fallbackLang.split('-').slice(0, 2).join('-')}-Wavenet-A`

          await appendLog(
            'WARN',
            `Chirp3 rejected sentence length; retrying chunk with ${fallbackVoice}`,
          )
          response = await loggedFetch(url, {
            method: 'POST',
            headers,
            body: buildRequestBody(fallbackVoice, fallbackLang),
          })
          if (response.ok) {
            const audioContent = (await response.json()).audioContent
            // Kept under the original request body, so re-reading this sentence
            // pays neither the Chirp3 rejection nor the retry.
            storeCachedAudio(requestBody, audioContent)
            return audioContent
          }
          message = (await response.json()).error?.message
        }

        if (message === 'API key not valid. Please pass a valid API key.') {
          const error = createError({
            errorCode: 'MISSING_API_KEY',
            errorMessage: 'Missing API key',
            errorTitle:
              "Your api key is invalid or missing. Please double check it has been entered correctly inside the extension's popup.",
          })

          sendMessageToCurrentTab(error)

          return error
        }

        const error = createError({
          errorCode: 'FAILED_TO_SYNTHESIZE_TEXT',
          errorTitle: 'An error occured while synthesizing text',
          errorMessage: message,
        })

        sendMessageToCurrentTab(error)

        await this.stopReading()

        return error
      }

      const audioContent = (await response.json()).audioContent
      storeCachedAudio(requestBody, audioContent)
      return audioContent
    } catch (e) {
      const error = createError({
        errorCode: 'FAILED_TO_SYNTHESIZE_TEXT',
        errorTitle: 'An error occured while synthesizing text',
        errorMessage:
          'An unknown error occured. Please try again later or contact us for more details.',
      })

      sendMessageToCurrentTab(error)

      await this.stopReading()

      return error
    }
  },
  getAudioUri: async function ({ text, encoding, voices }) {
    console.log('Getting audio URI...', { text, encoding })

    const chunks = text.chunk()
    console.log('Chunked text into', chunks.length, 'chunks', chunks)

    // Reuse the pair the Read Aloud session already resolved; a standalone
    // download resolves once here and shares it across its chunks.
    let resolution = voices
    if (!resolution) {
      const session = await chrome.storage.session.get()
      const sync = await chrome.storage.sync.get()
      resolution = resolveVoices(session, sync)
    }

    // Google answers bursts of simultaneous synthesize calls with 429s, which
    // used to fail the whole download; keep only a few requests in flight.
    const batchSize = 5
    const audioContents = []
    for (let i = 0; i < chunks.length; i += batchSize) {
      audioContents.push(
        ...await Promise.all(
          chunks
            .slice(i, i + batchSize)
            .map((chunk) =>
              this.synthesize({
                text: chunk,
                encoding,
                voices: resolution,
              }),
            ),
        ),
      )
    }
    const errorContents = audioContents.filter(isError)

    if (errorContents.length) {
      return errorContents[0]
    }

    return (
      `data:audio/${fileExtMap[encoding]};base64,` +
      mergeAudioChunks(audioContents, encoding)
    )
  },
  validateApiKey: async function () {
    console.log('Validating API key...')
    const sync = await chrome.storage.sync.get()
    if (!sync.apiKey) return false

    try {
      const response = await loggedFetch(
        `${process.env.TTS_API_URL}/voices`,
        { headers: { 'X-Goog-Api-Key': sync.apiKey } },
      )
      return response.ok
    } catch (e) {
      return false
    }
  },
  fetchVoices: async function () {
    console.log('Fetching voices...')

    const sync = await chrome.storage.sync.get()
    if (!sync.apiKey) {
      await chrome.storage.session.remove('voices')
      return []
    }

    const response = await loggedFetch(`${process.env.TTS_API_URL}/voices`, {
      headers: { 'X-Goog-Api-Key': sync.apiKey },
    })
    if (!response.ok) throw new Error('Failed to fetch voices')

    const payload = await response.json()
    const voices = Array.isArray(payload) ? payload : payload?.voices
    if (!voices) throw new Error('No voices found')

    await chrome.storage.session.set({ voices })
    await setLanguages()
    return voices
  },

}

// Helpers ---------------------------------------------------------------------
async function getActiveTabSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://')) {
      const err = createError({
        errorCode: 'UNSUPPORTED_TAB',
        errorTitle: 'Cannot read selection on browser settings pages',
        errorMessage:
          'Switch to a regular webpage and highlight text first, or use the Sandbox tab to enter custom text.',
      })
      await appendLog('WARN', 'Cannot read selection on restricted browser tab', {
        url: tab?.url,
      })
      return err
    }

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: retrieveSelection,
    })
    const text = result?.[0]?.result?.trim()

    if (!text) {
      const err = createError({
        errorCode: 'NO_TEXT_SELECTED',
        errorTitle: 'No text highlighted on the active page',
        errorMessage:
          'Highlight the text you want to synthesize on the webpage first, or use the Sandbox tab to type custom text.',
      })
      await appendLog('WARN', 'No text highlighted on the active tab', {
        url: tab.url,
      })
      return err
    }

    await appendLog('INFO', `Retrieved ${text.length} selected characters from active tab`, {
      preview: text.length > 100 ? `${text.slice(0, 100)}…` : text,
    })
    return text
  } catch (e: any) {
    await appendLog('ERROR', 'Failed to retrieve selection from active tab', e?.message)
    return createError({
      errorCode: 'SELECTION_FAILED',
      errorTitle: 'Could not read highlighted text on this page',
      errorMessage:
        'Refresh the webpage and try again, or paste the text into the Sandbox tab.',
    })
  }
}

async function updateContextMenus() {
  console.log('Updating context menus...', { playing, paused })
  await updatePlaybackSessionState()

  // Prevents context menus from being updated before they are created,
  // which causes an unnecessary error in the console.
  await bootstrapped

  const commands = await chrome.commands.getAll()
  const encoding = (await chrome.storage.sync.get()).downloadEncoding
  const fileExt = fileExtMap[encoding]
  const downloadShortcut = commands.find((c) => c.name === 'downloadShortcut')
    ?.shortcut

  chrome.contextMenus.update('readAloud', {
    enabled: true,
  })

  chrome.contextMenus.update('stopReading', {
    enabled: playing,
  })

  chrome.contextMenus.update('download', {
    title: `Download ${fileExt?.toUpperCase()}${
      downloadShortcut && ` (${downloadShortcut})`
    }`,
  })
}

async function createContextMenus() {
  console.log('Creating context menus...')
  chrome.contextMenus.removeAll()

  const commands = await chrome.commands.getAll()
  const readAloudShortcut = commands.find((c) => c.name === 'readAloudShortcut')
    ?.shortcut
  const downloadShortcut = commands.find((c) => c.name === 'downloadShortcut')
    ?.shortcut
  const downloadEncoding = (await chrome.storage.sync.get()).downloadEncoding
  const fileExt = fileExtMap[downloadEncoding]

  chrome.contextMenus.create({
    id: 'readAloud',
    title: `Read aloud${readAloudShortcut && ` (${readAloudShortcut})`}`,
    contexts: ['selection'],
    enabled: !playing,
  })

  chrome.contextMenus.create({
    id: 'stopReading',
    title: `Stop reading${readAloudShortcut && ` (${readAloudShortcut})`}`,
    contexts: ['all'],
    enabled: playing,
  })

  chrome.contextMenus.create({
    id: 'download',
    title: `Download ${fileExt?.toUpperCase()}${
      downloadShortcut && ` (${downloadShortcut})`
    }`,
    contexts: ['selection'],
  })
}

let creating
async function createOffscreenDocument() {
  const path = 'public/offscreen.html'

  if (await hasOffscreenDocument(path)) return

  if (creating) {
    await creating
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Plays synthesized audio in the background',
    })
    await creating
    creating = null
  }
}


/**
 * Checks whether an offscreen document at the given path is already active.
 * Uses `chrome.runtime.getContexts` (Chromium 116+ / Edge) with a fallback to
 * ServiceWorker `clients.matchAll()`.
 */
async function hasOffscreenDocument(path) {
  console.log('Checking if offscreen document exists...')

  const offscreenUrl = chrome.runtime.getURL(path)

  if ('getContexts' in chrome.runtime) {
    // @ts-ignore - chrome.runtime.getContexts added in MV3 (Chromium 116+)
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl],
    })
    return contexts.length > 0
  }

  // @ts-ignore
  const matchedClients = await clients.matchAll()

  for (const client of matchedClients) {
    if (client.url === offscreenUrl) return true
  }

  return false
}

async function setDefaultSettings() {
  console.info('Setting default settings...')

  await chrome.storage.session.setAccessLevel({
    accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
  })

  const sync = await chrome.storage.sync.get()

  await chrome.storage.sync.set({
    language: sync.language || 'en-US',
    speed: sync.speed || 1,
    pitch: sync.pitch || 0,
    voices: sync.voices || { 'en-US': 'en-US-Polyglot-1' },
    readAloudEncoding:
      !sync.readAloudEncoding || sync.readAloudEncoding === 'MP3_64_KBPS'
        ? 'OGG_OPUS'
        : sync.readAloudEncoding,
    downloadEncoding:
      !sync.downloadEncoding || sync.downloadEncoding === 'MP3_64_KBPS'
        ? 'MP3'
        : sync.downloadEncoding,
    apiKey: sync.apiKey || '',
    audioProfile: sync.audioProfile || 'default',
    volumeGainDb: sync.volumeGainDb || 0,
    autoReadAloud:
      typeof sync.autoReadAloud === 'boolean' ? sync.autoReadAloud : false,
    highlightSpokenWords:
      typeof sync.highlightSpokenWords === 'boolean'
        ? sync.highlightSpokenWords
        : true,
    showSelectionToolbar:
      typeof sync.showSelectionToolbar === 'boolean'
        ? sync.showSelectionToolbar
        : true,
    theme:
      sync.theme === 'light' || sync.theme === 'dark' || sync.theme === 'system'
        ? sync.theme
        : 'system',
  })
}

async function setLanguages() {
  console.log('Setting languages...')

  const session = await chrome.storage.session.get()

  if (!session.voices) {
    throw new Error('No voices found. Cannot set languages.')
  }

  const languages = new Set(
    session.voices.map((voice) => voice.languageCodes).flat(),
  )

  await chrome.storage.session.set({ languages: Array.from(languages) })

  return languages
}

function retrieveSelection() {
  console.log('Retrieving selection...')

  const activeElement = document.activeElement
  if (
    activeElement?.tagName === 'INPUT' ||
    activeElement?.tagName === 'TEXTAREA'
  ) {
    const start = (activeElement as HTMLInputElement).selectionStart
    const end = (activeElement as HTMLInputElement).selectionEnd

    return (activeElement as HTMLInputElement).value.slice(start, end)
  }

  return window.getSelection()?.toString()
}

async function sendMessageToCurrentTab(event) {
  console.log('Sending message to current tab...')

  const currentTab = await resolveTargetTab(sessionTabId, chrome.tabs)

  if (
    !currentTab?.id ||
    currentTab.url?.startsWith('chrome://') ||
    currentTab.url?.startsWith('edge://')
  ) {
    console.warn('No valid current tab found. Aborting message send.')
    return
  }

  try {
    return await chrome.tabs.sendMessage(currentTab.id, event)
  } catch {
    // If the tab was opened before the extension was loaded or reloaded,
    // dynamically inject `content-script.js` and retry once.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['content-script.js'],
      })
      return await chrome.tabs.sendMessage(currentTab.id, event)
    } catch {
      return
    }
  }
}

