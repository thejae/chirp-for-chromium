import './helpers/text-helpers.js'
import { fileExtMap, mergeAudioChunks } from './helpers/file-helpers.js'
import { initializeSentry } from './helpers/sentry-helpers.js'
import { createError, isError } from './helpers/error-helpers.js'
import { getCurrentVoice } from './helpers/voice-helpers.js'
import { appendLog, clearLogs, loggedFetch } from './helpers/log-helpers.js'

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

// Bootstrap -------------------------------------------------------------------
initializeSentry()
;(async function Bootstrap() {
  await setDefaultSettings()
  await appendLog('INFO', 'Service worker bootstrapping…')
  try {
    await handlers.fetchVoices()
  } catch (e: any) {
    await appendLog('WARN', 'Initial voice fetch failed during bootstrap', e?.message)
  }
  try {
    await handlers.fetchUser()
  } catch (e: any) {
    await appendLog('WARN', 'Initial user fetch failed during bootstrap', e?.message)
  }
  await createContextMenus()
  bootstrappedResolver()
  await appendLog('INFO', 'Service worker bootstrap complete')
  await pollForPayment()
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
  if (id !== 'clearLogs' && id !== 'chunkPlaybackStarted') {
    appendLog('INFO', `Runtime message received: ${id}`, payload)
  }
  handlers[id](payload).then(sendResponse)

  return true
})

chrome.storage.onChanged.addListener(function (changes) {
  console.log('Handling storage change...', changes)

  if (changes.downloadEncoding) {
    updateContextMenus()
  }

  if (changes.paymentSession) {
    pollForPayment()
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

  // New installs should default to the paid mode.
  if (details.reason === 'install') {
    await chrome.storage.sync.set({ mode: 'paid' })
  }

  if (details.reason === 'update') {
    const sync = await chrome.storage.sync.get()

    // Previous versions of the extension didn't have the mode setting should
    // default to the free mode when they have an API key.
    if (typeof sync.mode === 'undefined') {
      await chrome.storage.sync.set({ mode: sync.apiKey ? 'free' : 'paid' })
    }
  }
})

// Handlers --------------------------------------------------------------------
export const handlers = {
  clearLogs: async function () {
    await clearLogs()
    return true
  },
  readAloud: async function ({ text, highlight = true }) {
    console.log('Reading aloud...', { text, highlight })

    if (playing) await this.stopReading()

    const chunks = text.chunk()
    console.log('Chunked text into', chunks.length, 'chunks', chunks)
    await appendLog(
      'INFO',
      `Reading aloud (${text.length} chars in ${chunks.length} chunk${chunks.length === 1 ? '' : 's'})`,
      { chunks },
    )

    queue.push(...chunks)
    playing = true
    paused = false
    totalChunks = chunks.length
    currentChunkIndex = 0
    currentChunkDuration = 0
    chunkLengths = chunks.map((chunk) => chunk.length)
    totalChars = chunkLengths.reduce((sum, len) => sum + len, 0)
    completedChars = 0
    activeChunkText = chunks[0] || ''
    await updatePlaybackSessionState()
    updateContextMenus()

    let count = 0
    const sync = await chrome.storage.sync.get()
    const encoding = sync.readAloudEncoding
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
        updateContextMenus()
        if (highlightingEnabled) {
          await sendMessageToCurrentTab({ id: 'highlightSessionEnd' })
        }
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
        prefetchQueue.push(this.getAudioUri({ text: nextText, encoding }))
      }

      const audioUri =
        count === 0
          ? await this.getAudioUri({ text, encoding })
          : await prefetchQueue.shift()

      try {
        if (isError(audioUri)) {
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
          updateContextMenus()
          if (highlightingEnabled) {
            await sendMessageToCurrentTab({ id: 'highlightSessionEnd' })
          }
          return audioUri
        }

        await createOffscreenDocument()
        await appendLog('INFO', `Playing audio chunk ${count + 1}`)
        await chrome.runtime.sendMessage({
          id: 'play',
          payload: { audioUri },
          offscreen: true,
        })
      } catch (e: any) {
        console.warn('Failed to play audio', e)
        await appendLog('WARN', 'Audio playback interrupted or failed', e?.message)
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
        updateContextMenus()
        if (highlightingEnabled) {
          await sendMessageToCurrentTab({ id: 'highlightSessionEnd' })
        }

        // Audio playback may have failed because the user stopped playback, or
        // called the readAloud function again. We need to return early to avoid
        // playing the next chunk.
        return
      }

      console.log('Play through of audio complete. Enqueuing next chunk.')
      count++
    }

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
    updateContextMenus()
    if (highlightingEnabled) {
      await sendMessageToCurrentTab({ id: 'highlightSessionEnd' })
    }
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
    if (sync.autoReadAloud === false) return false

    const hasCredentials =
      (sync.mode === 'free' && Boolean(sync.apiKey)) ||
      (sync.mode === 'paid' && Boolean(sync.user?.credits))
    if (!hasCredentials) return false

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
    updateContextMenus()
    if (highlightingEnabled) {
      await sendMessageToCurrentTab({ id: 'highlightSessionEnd' })
    }

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
  synthesize: async function ({ text, encoding }) {
    console.log('Synthesizing text...', { text, encoding })

    const session = await chrome.storage.session.get()
    const sync = await chrome.storage.sync.get()
    const key = sync.mode === 'paid' ? sync.user?.secret_key : sync.apiKey

    let url = `${process.env.BACKEND_URL}/synthesize`
    if (sync.mode !== 'paid') url += `?key=${key}`

    const headers = { 'Content-Type': 'application/json' }
    if (sync.mode === 'paid') headers['Authorization'] = `Bearer ${key}`

    if (!key) {
      const error = createError({
        errorCode: 'MISSING_API_KEY',
        errorMessage: 'Missing API key',
        errorTitle:
          "Your api key is invalid or missing. Please double check it has been entered correctly inside the extension's popup.",
      })

      await appendLog('ERROR', 'Synthesis aborted: Missing API key or credentials')
      sendMessageToCurrentTab(error)

      return error
    }

    let ssml = undefined
    if (text.isSSML()) {
      ssml = text
      text = undefined
    }

    // Normalize UI encoding aliases to encodings supported across all Google Cloud TTS voices
    // (Chirp/Journey/Studio voices reject legacy MP3_64_KBPS and require MP3, OGG_OPUS, or LINEAR16).
    const apiEncoding =
      encoding === 'PCM'
        ? 'LINEAR16'
        : encoding === 'MP3_64_KBPS'
        ? 'MP3'
        : encoding

    const rawContent = text || ssml || ''
    const hasCjk = /[\u3400-\u9fff]/.test(rawContent)
    let voiceLanguageCode = sync.language || 'en-US'
    let voiceName = getCurrentVoice(session, sync)

    // Non-CJK Chirp3/Journey voices (such as en-US-Chirp3-HD-*) reject Chinese
    // ideographs with `Sentence starting with: "⟪..." is too long`. Automatically
    // switch to a Mandarin voice for chunks containing Chinese characters.
    if (hasCjk && !/^(cmn|zh|yue|ja|ko)-/i.test(voiceLanguageCode)) {
      voiceLanguageCode = 'cmn-CN'
      const persona = voiceName?.includes('-Chirp3-HD-')
        ? voiceName.split('-Chirp3-HD-')[1]
        : null
      const candidateChirp = persona ? `cmn-CN-Chirp3-HD-${persona}` : null
      const availableNames = new Set(
        (session.voices || []).map((v: any) => v.name),
      )

      if (candidateChirp && availableNames.has(candidateChirp)) {
        voiceName = candidateChirp
      } else if (sync.voices?.['cmn-CN']) {
        voiceName = sync.voices['cmn-CN']
      } else if (availableNames.has('cmn-CN-Wavenet-A')) {
        voiceName = 'cmn-CN-Wavenet-A'
      } else {
        voiceName = candidateChirp || 'cmn-CN-Wavenet-A'
      }
    }

    const buildRequestBody = (overrideVoice?: string, overrideLang?: string) =>
      JSON.stringify({
        text: text,
        ssml: ssml,
        voice_name: overrideVoice || voiceName,
        voice_language_code: overrideLang || voiceLanguageCode,
        audio_pitch: sync.pitch,
        audio_speaking_rate: sync.speed,
        audio_volume_gain_db: sync.volumeGainDb,
        audio_encoding: apiEncoding,
        audio_profile:
          sync.audioProfile !== 'default' ? [sync.audioProfile] : undefined,
        extension_version: chrome.runtime.getManifest().version,
      })

    try {
      let response = await loggedFetch(url, {
        method: 'POST',
        headers,
        body: buildRequestBody(),
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
            return (await response.json()).audioContent
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

      return (await response.json()).audioContent
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
  getAudioUri: async function ({ text, encoding }) {
    console.log('Getting audio URI...', { text, encoding })

    const chunks = text.chunk()
    console.log('Chunked text into', chunks.length, 'chunks', chunks)

    const promises = chunks.map((text) => this.synthesize({ text, encoding }))
    const audioContents = await Promise.all(promises)
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

    try {
      const response = await loggedFetch(
        `${process.env.TTS_API_URL}/voices?key=${sync.apiKey}`,
      )
      return response.ok
    } catch (e) {
      return false
    }
  },
  fetchVoices: async function () {
    console.log('Fetching voices...')

    const response = await loggedFetch(`${process.env.BACKEND_URL}/voices`)
    if (!response.ok) throw new Error('Failed to fetch voices')

    const voices = await response.json()
    if (!voices) throw new Error('No voices found')

    await chrome.storage.session.set({ voices })
    await setLanguages()
    return voices
  },

  // ---------------------------------------------------------------------------
  authenticate: async function () {
    console.log('Authenticating...')
    await appendLog('INFO', 'Starting Google OAuth authentication')

    try {
      const token = await getOAuthToken()
      const userResult = await loggedFetch(`${process.env.BACKEND_URL}/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!userResult.ok) {
        throw new Error('Failed to authenticate user with backend')
      }

      const user = await userResult.json()

      await chrome.storage.sync.set({ user })
      await appendLog('INFO', 'User authenticated successfully')

      return user
    } catch (e: any) {
      await appendLog('ERROR', 'Authentication failed', e?.message)
      const error = createError({
        errorCode: 'AUTHENTICATION_FAILED',
        errorTitle: 'Authentication failed',
        errorMessage: 'Please try again later or contact us for more details.',
      })

      return error
    }
  },
  createPaymentSession: async function () {
    console.log('Creating payment session...')

    // Authenticate the user first
    const user = await this.authenticate()
    if (isError(user)) return user
    if (!user) {
      throw new Error('Failed to authenticate user')
    }

    if (user.credits > 0) {
      console.log('User has credits, skipping payment session creation')
      return
    }

    // Return the existing payment session if it exists.
    const session = await chrome.storage.session.get()
    if (session.paymentSession) return session.paymentSession

    const response = await loggedFetch(
      `${process.env.BACKEND_URL}/payment-sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      const error = createError({
        errorCode: 'FAILED_TO_CREATE_PAYMENT_SESSION',
        errorTitle: 'Failed to create payment session',
        errorMessage: 'Please try again later or contact us for more details.',
      })

      sendMessageToCurrentTab(error)

      return error
    }

    const paymentSession = await response.json()

    console.log('Payment session result', paymentSession)

    await chrome.storage.session.set({ paymentSession })

    return paymentSession
  },
  fetchUser: async function () {
    const sync = await chrome.storage.sync.get()
    if (!sync.user?.secret_key) return

    const response = await loggedFetch(`${process.env.BACKEND_URL}/users`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${sync.user.secret_key}` },
    })

    if (!response.ok) throw new Error('Failed to fetch user')

    const user = await response.json()

    await chrome.storage.sync.set({ user })

    return user
  },
  fetchUsage: async function () {
    const sync = await chrome.storage.sync.get()
    if (!sync.user?.secret_key) return

    const response = await loggedFetch(`${process.env.BACKEND_URL}/insights`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${sync.user.secret_key}` },
    })

    if (!response.ok) throw new Error('Failed to fetch usage')

    const usage = await response.json()

    return usage
  },
  fetchInvoices: async function () {
    console.log('Fetching invoices...')

    const sync = await chrome.storage.sync.get()
    if (!sync.user?.secret_key) return

    const response = await loggedFetch(`${process.env.BACKEND_URL}/invoices`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${sync.user.secret_key}` },
    })

    if (!response.ok) throw new Error('Failed to fetch invoices')

    return response.json()
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
 * Obtains a Google OAuth2 access token.
 *
 * Attempts Chrome's native `chrome.identity.getAuthToken` first, and falls back
 * to `chrome.identity.launchWebAuthFlow` on Microsoft Edge and other Chromium
 * browsers where `getAuthToken` is unsupported.
 */
async function getOAuthToken(): Promise<string> {
  if (!navigator.userAgent.includes('Edg/') && chrome.identity?.getAuthToken) {
    try {
      const authTokenResult = await chrome.identity.getAuthToken({
        interactive: true,
      })
      if (authTokenResult?.token) return authTokenResult.token
    } catch (e) {
      console.warn(
        'chrome.identity.getAuthToken failed, falling back to launchWebAuthFlow',
        e,
      )
    }
  }

  const redirectUri = chrome.identity.getRedirectURL()
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', process.env.GOOGLE_OAUTH2_CLIENT_ID)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/userinfo.email',
  )

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  })

  if (!responseUrl) {
    throw new Error('No response URL returned from launchWebAuthFlow')
  }

  const hash = new URL(responseUrl).hash.substring(1)
  const params = new URLSearchParams(hash)
  const token = params.get('access_token')

  if (!token) {
    throw new Error('No access_token present in OAuth redirect URL')
  }

  return token
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
      typeof sync.autoReadAloud === 'boolean' ? sync.autoReadAloud : true,
    highlightSpokenWords:
      typeof sync.highlightSpokenWords === 'boolean'
        ? sync.highlightSpokenWords
        : true,
    showSelectionToolbar:
      typeof sync.showSelectionToolbar === 'boolean'
        ? sync.showSelectionToolbar
        : true,
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

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const currentTab = tabs[0]

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

// TODO(mike): Ideally use pheonix channels instead of polling.
// When the session has a payment session and the user doesn't have any credits
// we poll the server every 5 seconds to check if the payment has been processed.
// If the payment session has expired, we also remove it from the session storage.
//
// When the payment has been processed we remove the payment session from the
// session storage triggering a re-render of any components that depend on it.
async function pollForPayment() {
  console.log('Polling for payment...')

  const session = await chrome.storage.session.get()
  if (!session.paymentSession) {
    console.log('No payment session found. Aborting poll.')
    return
  }

  const expiryDate = new Date(session.paymentSession.expiry_date)

  const interval = setInterval(async () => {
    const currentDate = new Date(new Date().toUTCString())

    if (currentDate > expiryDate) {
      console.log('Payment session has expired. Removing payment session...')
      await chrome.storage.session.remove('paymentSession')
      clearInterval(interval)
      return
    }

    console.log('Checking if payment has been processed...')
    const user = await handlers.fetchUser()
    if (user.credits > 0) {
      console.log('Payment has been processed. Removing payment session...')
      await chrome.storage.session.remove('paymentSession')
      clearInterval(interval)
    } else {
      console.log('Payment has not been processed yet...')
    }
  }, 5000)
}
