import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Textarea } from '../../../components/inputs/Textarea.jsx'
import { Download, Play, Sliders, Square } from 'react-feather'
import { Button } from '../../../components/Button.js'
import { useSync } from '../../../hooks/useSync.js'
import { useSession } from '../../../hooks/useSession.js'
import { useLocalStorage } from '../../../hooks/useLocalStorage.js'
import { useStore } from '../../../hooks/useStore.js'
import { errorStore } from '../../extension.js'
import { isError } from '../../helpers/error-helpers.js'
import { getCurrentVoice } from '../../helpers/voice-helpers.js'

/**
 * Interactive text/SSML synthesis studio showing the currently active voice
 * and speed with one-click playback and MP3 download.
 */
export function Sandbox() {
  const navigate = useNavigate()
  const { ready, sync } = useSync()
  const { session } = useSession()
  const [text, setText] = useLocalStorage('sandboxInput', '')
  const [valueError, setValueError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [, setError] = useStore(errorStore)

  if (!ready) {
    return (
      <div className="text-xs text-neutral-500 py-6 text-center">
        Loading sandbox…
      </div>
    )
  }

  const activeVoice = getCurrentVoice(session, sync)
  const shortVoiceName = activeVoice
    ? activeVoice.split('-').slice(2).join(' ')
    : 'Default voice'
  const isPlaying = playing || Boolean(session?.playing)

  function handleValidation() {
    if (sync.mode === 'free' && !sync.apiKeyValid) {
      setValueError('Please add and verify your Google Cloud API key in Credentials')
      return false
    }

    if (!text?.trim()) {
      setValueError('Enter text or SSML to synthesize')
      return false
    }

    return true
  }

  async function handleDownload() {
    if (!handleValidation()) return
    setDownloading(true)
    const response = await chrome.runtime.sendMessage({
      id: 'download',
      payload: { text },
    })
    if (isError(response)) setError(response)

    handleReset()
  }

  async function handleReadAloud() {
    if (!handleValidation()) return
    setPlaying(true)

    const response = await chrome.runtime.sendMessage({
      id: 'readAloud',
      payload: { text, highlight: false },
    })
    if (isError(response)) setError(response)

    handleReset()
  }

  async function handleStop() {
    await chrome.runtime.sendMessage({ id: 'stopReading' })
    handleReset()
  }

  function handleReset() {
    setValueError('')
    setDownloading(false)
    setPlaying(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 ml-0.5">
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight">
          Sandbox
        </h2>
        <button
          type="button"
          onClick={() => navigate('/preferences')}
          title="Change voice or speed in Voice & speech settings"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-xxs font-medium text-neutral-700 hover:border-blue-300 hover:text-blue-700 transition-colors tabular-nums"
        >
          <Sliders size={11} className="text-indigo-500" />
          <span>
            {sync.language} · {shortVoiceName} · {sync.speed}×
          </span>
        </button>
      </div>
      <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-3 grow">
        <Textarea
          label="Text or SSML"
          placeholder="Type or paste any text (or <speak>...</speak> SSML) to read aloud or export as audio…"
          value={text}
          onChange={(val) => {
            setText(val)
            if (valueError) setValueError('')
          }}
          error={valueError}
          className="h-full"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xxs text-neutral-500 tabular-nums">
            {(text?.length || 0).toLocaleString()} characters
          </span>
          <div className="flex gap-2 w-fit ml-auto">
            <Button
              Icon={Download}
              onClick={handleDownload}
              submitting={downloading}
            >
              Download
            </Button>
            <Button
              type={isPlaying ? 'danger' : 'primary'}
              Icon={isPlaying ? Square : Play}
              onClick={isPlaying ? handleStop : handleReadAloud}
            >
              {isPlaying ? 'Stop playback' : 'Read aloud'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
