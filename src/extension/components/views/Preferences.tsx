import React, { useState } from 'react'
import { Dropdown } from '../../../components/inputs/Dropdown.jsx'
import { Range } from '../../../components/inputs/Range.jsx'
import {
  ChevronDown,
  Command,
  Download,
  Play,
  Square,
  Volume2,
} from 'react-feather'
import { Button } from '../../../components/Button.js'
import { useSession } from '../../../hooks/useSession.js'
import { useSync } from '../../../hooks/useSync.js'
import { useStore } from '../../../hooks/useStore.js'
import { errorStore } from '../../extension.js'
import { isError } from '../../helpers/error-helpers.js'
import {
  getLanguageOptions,
  getVoiceOptions,
} from '../../helpers/voice-helpers.js'
import { fileExtMap } from '../../helpers/file-helpers.js'

const downloadAudioFormats = [
  {
    value: 'MP3_64_KBPS',
    title: 'MP3 (64 kbps)',
    description: 'Recommended · High quality MP3',
  },
  {
    value: 'MP3',
    title: 'MP3 (32 kbps)',
    description: 'Smaller file size',
  },
  {
    value: 'OGG_OPUS',
    title: 'Opus (OGG)',
    description: 'High quality · Efficient compression',
  },
  {
    value: 'PCM',
    title: 'Uncompressed PCM (WAV)',
    description: 'Lossless 16-bit Linear PCM audio',
  },
  {
    value: 'LINEAR16',
    title: 'WAV (Linear 16-bit)',
    description: 'Lossless 16-bit WAV audio',
  },
]

const readingAudioFormats = [
  {
    value: 'OGG_OPUS',
    title: 'Opus (OGG)',
    description: 'Recommended · Lowest latency',
  },
  {
    value: 'PCM',
    title: 'Uncompressed PCM (WAV)',
    description: 'Lossless 16-bit Linear PCM audio',
  },
  {
    value: 'LINEAR16',
    title: 'WAV (Linear 16-bit)',
    description: 'Lossless 16-bit WAV audio',
  },
  {
    value: 'MP3_64_KBPS',
    title: 'MP3 (64 kbps)',
    description: 'Standard compressed',
  },
  {
    value: 'MP3',
    title: 'MP3 (32 kbps)',
    description: 'Low bandwidth',
  },
]

const audioProfiles = [
  {
    value: 'default',
    title: 'Default (No EQ)',
    description: 'Recommended · Natural studio balance',
  },
  {
    value: 'headphone-class-device',
    title: 'Headphones & earbuds',
    description: 'Tuned for in-ear and over-ear listening',
  },
  {
    value: 'handset-class-device',
    title: 'Phone & tablet speakers',
    description: 'Clearer midrange on mobile devices',
  },
  {
    value: 'small-bluetooth-speaker-class-device',
    title: 'Portable Bluetooth speaker',
    description: 'Compact wireless speakers',
  },
  {
    value: 'medium-bluetooth-speaker-class-device',
    title: 'Desktop speaker',
    description: 'Bookshelf and desktop monitors',
  },
  {
    value: 'large-home-entertainment-class-device',
    title: 'Home theater & TV',
    description: 'Full-range living room systems',
  },
  {
    value: 'large-automotive-class-device',
    title: 'Car audio',
    description: 'Compensates for road noise',
  },
  {
    value: 'wearable-class-device',
    title: 'Smartwatch & wearable',
    description: 'Small wrist speakers',
  },
  {
    value: 'telephony-class-application',
    title: 'Voice call / Telephony',
    description: 'Narrowband speech clarity',
  },
]

const PREVIEW_SAMPLES: Record<string, string> = {
  en: 'Hello! This is a preview of how this voice sounds when reading aloud.',
  fr: 'Bonjour ! Voici un aperçu de cette voix lors de la lecture à haute voix.',
  es: '¡Hola! Esta es una vista previa de cómo suena esta voz al leer en voz alta.',
  de: 'Hallo! Dies ist eine Vorschau darauf, wie diese Stimme beim Vorlesen klingt.',
  ja: 'こんにちは。これは音声読み上げのプレビューです。',
  zh: '您好！这是该语音朗读时的试听效果。',
}

/**
 * Primary Voice & Speech settings view with live voice audition preview,
 * speed presets, and progressive disclosure for advanced DSP/codec controls.
 */
export function Preferences() {
  const { ready: sessionReady, session } = useSession()
  const { ready: syncReady, sync, setSync } = useSync()
  const [, setError] = useStore(errorStore)
  const [previewing, setPreviewing] = useState(false)
  const [downloadingSelection, setDownloadingSelection] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!sessionReady || !syncReady) {
    return (
      <div className="text-xs text-neutral-500 py-6 text-center">
        Loading voice preferences…
      </div>
    )
  }

  const languageOptions = getLanguageOptions(session)
  const voiceOptions = getVoiceOptions(session, sync.language)
  const voice = sync.voices[sync.language] || voiceOptions[0]?.value
  const selectedVoiceOption = voiceOptions.find((v) => v.value === voice)
  const isMac = navigator.platform?.toUpperCase().includes('MAC')
  const isPlaying = Boolean(session?.playing)
  const downloadFormatExt = (
    fileExtMap[sync.downloadEncoding] || 'mp3'
  ).toUpperCase()

  async function handleReadAloudSelection() {
    if (isPlaying) {
      await chrome.runtime.sendMessage({ id: 'stopReading' })
      setPreviewing(false)
      return
    }

    const response = await chrome.runtime.sendMessage({
      id: 'readAloudShortcut',
    })
    if (isError(response)) {
      setError(response)
    }
  }

  async function handleDownloadSelection() {
    setDownloadingSelection(true)
    const response = await chrome.runtime.sendMessage({
      id: 'downloadShortcut',
    })
    setDownloadingSelection(false)
    if (isError(response)) {
      setError(response)
    }
  }

  async function handlePreviewVoice() {
    if (previewing || isPlaying) {
      await chrome.runtime.sendMessage({ id: 'stopReading' })
      setPreviewing(false)
      return
    }

    const langPrefix = (sync.language || 'en-US').split('-')[0]
    const sampleText = PREVIEW_SAMPLES[langPrefix] || PREVIEW_SAMPLES.en

    setPreviewing(true)
    const response = await chrome.runtime.sendMessage({
      id: 'readAloud',
      payload: { text: sampleText },
    })
    setPreviewing(false)
    if (isError(response)) {
      setError(response)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-2 ml-0.5">
          <h2 className="text-sm font-semibold text-neutral-800 tracking-tight">
            Voice & speech
          </h2>
          {selectedVoiceOption && (
            <span className="text-xxs text-neutral-500 font-medium">
              {selectedVoiceOption.title} · {selectedVoiceOption.description}
            </span>
          )}
        </div>
        <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Dropdown
              label="Language"
              value={sync.language}
              onChange={(language) => {
                if (languageOptions.find((l: any) => l.value === language)) {
                  setSync({ ...sync, language })
                }
              }}
              placeholder="Select language"
              options={languageOptions}
            />
            <Dropdown
              label="Voice"
              value={voice}
              onChange={(nextVoice) => {
                if (voiceOptions.find((v) => v.value === nextVoice)) {
                  setSync({
                    ...sync,
                    voices: { ...sync.voices, [sync.language]: nextVoice },
                  })
                }
              }}
              placeholder="Select voice"
              options={voiceOptions}
            />
          </div>

          <Range
            label="Speaking speed"
            min={0.5}
            max={3}
            step={0.05}
            value={sync.speed}
            defaultValue={1}
            presets={[0.75, 1, 1.25, 1.5, 2]}
            unit="×"
            onChange={(speed) => setSync({ ...sync, speed })}
            ticks={[0.5, 1, 1.5, 2, 2.5, 3]}
          />

          <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
            <span className="flex items-center gap-1.5 text-xxs text-neutral-500">
              <Volume2 size={13} className="text-neutral-400 shrink-0" />
              Audition current voice, speed, and pitch
            </span>
            <Button
              className="w-fit py-1.5 px-3"
              type={previewing ? 'secondary' : 'default'}
              Icon={previewing ? Square : Play}
              onClick={handlePreviewVoice}
            >
              {previewing ? 'Stop preview' : 'Preview voice'}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between bg-white px-3.5 py-2.5 rounded-lg shadow-sm border border-neutral-200 text-left hover:bg-neutral-50/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div>
            <div className="text-xs font-semibold text-neutral-800">
              Advanced audio & format settings
            </div>
            <div className="text-xxs text-neutral-500">
              Pitch ({sync.pitch > 0 ? `+${sync.pitch}` : sync.pitch}), Volume (
              {sync.volumeGainDb > 0
                ? `+${sync.volumeGainDb}`
                : sync.volumeGainDb}
              dB), EQ profile & codecs
            </div>
          </div>
          <ChevronDown
            size={15}
            className={`text-neutral-500 transition-transform duration-150 ${
              showAdvanced ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showAdvanced && (
          <div className="mt-2 bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-4">
            <Dropdown
              label="Device EQ profile"
              value={sync.audioProfile}
              onChange={(audioProfile) => {
                if (audioProfiles.find((p) => p.value === audioProfile)) {
                  setSync({ ...sync, audioProfile })
                }
              }}
              placeholder="Select audio profile"
              options={audioProfiles}
            />

            <Range
              label="Voice pitch"
              min={-10}
              max={10}
              step={0.1}
              value={sync.pitch}
              defaultValue={0}
              onChange={(pitch) => setSync({ ...sync, pitch })}
              ticks={[-10, -5, 0, 5, 10]}
            />

            <Range
              label="Volume gain"
              min={-16}
              max={16}
              step={1}
              value={sync.volumeGainDb}
              defaultValue={0}
              unit="dB"
              onChange={(volumeGainDb) => setSync({ ...sync, volumeGainDb })}
              ticks={[-16, -8, 0, 8, 16]}
            />

            <div className="grid gap-3 grid-cols-2 pt-2 border-t border-neutral-100">
              <Dropdown
                label="Download format"
                value={sync.downloadEncoding}
                options={downloadAudioFormats}
                onChange={(downloadEncoding) => {
                  if (
                    downloadAudioFormats.find(
                      (f) => f.value === downloadEncoding,
                    )
                  ) {
                    setSync({ ...sync, downloadEncoding })
                  }
                }}
              />
              <Dropdown
                label="Streaming format"
                value={sync.readAloudEncoding}
                options={readingAudioFormats}
                onChange={(readAloudEncoding) => {
                  if (
                    readingAudioFormats.find(
                      (f) => f.value === readAloudEncoding,
                    )
                  ) {
                    setSync({ ...sync, readAloudEncoding })
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight mb-2 ml-0.5">
          Page actions & shortcuts
        </h2>
        <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              type={isPlaying ? 'danger' : 'primary'}
              Icon={isPlaying ? Square : Play}
              onClick={handleReadAloudSelection}
            >
              {isPlaying ? 'Stop reading' : 'Read aloud'}
            </Button>
            <Button
              Icon={Download}
              submitting={downloadingSelection}
              onClick={handleDownloadSelection}
            >
              Download {downloadFormatExt}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-100">
            <div className="flex flex-col gap-1 text-xxs text-neutral-600">
              <div>
                <span className="font-medium text-neutral-800">
                  Read aloud shortcut:
                </span>{' '}
                <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded font-mono">
                  {isMac ? '⌘+Shift+S' : 'Ctrl+Shift+S'}
                </kbd>
              </div>
              <div>
                <span className="font-medium text-neutral-800">
                  Download {downloadFormatExt} shortcut:
                </span>{' '}
                <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded font-mono">
                  {isMac ? '⌘+Shift+E' : 'Ctrl+Shift+E'}
                </kbd>
              </div>
            </div>
            <Button
              className="w-fit shrink-0 py-1.5 px-2.5"
              Icon={Command}
              onClick={() => {
                const isEdge = navigator.userAgent.includes('Edg/')
                chrome.tabs.create({
                  url: isEdge
                    ? 'edge://extensions/shortcuts'
                    : 'chrome://extensions/shortcuts',
                })
              }}
            >
              Edit shortcuts
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
