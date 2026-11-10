import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Pause, Play, Sliders, Square, Volume2 } from 'react-feather'
import { useSession } from '../../../hooks/useSession.js'
import { useSync } from '../../../hooks/useSync.js'

/**
 * Compact persistent audio player docked at the bottom of the extension popup.
 *
 * Provides non-destructive Play / Pause / Resume controls (preserving spoken
 * sentence position), real-time sentence progress indicators, active text
 * snippet previews, and active voice details.
 */
export function MiniPlayer() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { sync } = useSync()

  const isPlaying = Boolean(session?.playing)
  const isPaused = Boolean(session?.paused)
  const totalChunks = session?.totalChunks || 0
  const currentChunkIndex = session?.currentChunkIndex || 0
  const activeText = session?.activeChunkText?.trim() || ''

  // Format active voice name cleanly (e.g., 'en-US-Journey-F' -> 'Journey F')
  const rawVoiceName = sync?.voice || ''
  const displayVoiceName =
    rawVoiceName
      .replace(/^[a-z]{2,3}-[A-Z]{2}-/, '')
      .replace(/^(Neural2|Wavenet|Standard|Studio|Journey|Polyglot|Casual)-/, '$1 ')
      .replace(/-/g, ' ') || 'Default'
  const speed = typeof sync?.speed === 'number' ? sync.speed.toFixed(1) : '1.0'

  const progressPercent =
    totalChunks > 0
      ? Math.min(
          100,
          Math.max(
            5,
            Math.round(
              ((currentChunkIndex + (isPaused ? 0.5 : 1)) / totalChunks) * 100,
            ),
          ),
        )
      : 0

  async function handleTogglePlayPause() {
    if (!isPlaying) {
      await chrome.runtime.sendMessage({ id: 'readAloudShortcut' })
      return
    }
    if (isPaused) {
      await chrome.runtime.sendMessage({ id: 'resumeReading' })
    } else {
      await chrome.runtime.sendMessage({ id: 'pauseReading' })
    }
  }

  async function handleStop() {
    await chrome.runtime.sendMessage({ id: 'stopReading' })
  }

  return (
    <section
      aria-label="Now playing audio controls"
      className="shrink-0 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] px-3.5 py-2 flex flex-col gap-1.5"
    >
      {/* Progress track when playing */}
      {isPlaying && totalChunks > 0 && (
        <div className="w-full h-1 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 min-w-0">
        {/* Playback action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleTogglePlayPause}
            aria-label={
              isPlaying ? (isPaused ? 'Resume reading' : 'Pause reading') : 'Read highlighted text'
            }
            title={
              isPlaying ? (isPaused ? 'Resume reading' : 'Pause reading') : 'Read highlighted text'
            }
            className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            {isPlaying && !isPaused ? (
              <Pause size={14} className="fill-current" />
            ) : (
              <Play size={14} className="fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleStop}
            disabled={!isPlaying}
            aria-label="Stop reading"
            title="Stop reading"
            className="h-8 w-8 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Square size={13} className="fill-current" />
          </button>
        </div>

        {/* Status / active snippet preview */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {isPlaying ? (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 text-xxs font-medium text-neutral-500">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isPaused ? 'bg-amber-500' : 'bg-blue-600 animate-pulse'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-semibold text-neutral-700 tracking-tight">
                  {isPaused ? 'PAUSED' : 'READING'}
                </span>
                {totalChunks > 0 && (
                  <span>
                    · Sentence {currentChunkIndex + 1} of {totalChunks}
                  </span>
                )}
              </div>
              <p
                className="text-xs text-neutral-800 truncate font-normal leading-tight mt-0.5"
                title={activeText}
              >
                {activeText ? `“${activeText}”` : 'Synthesizing speech…'}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Volume2 size={14} className="text-neutral-400 shrink-0" />
              <span className="truncate">
                Ready to read · Highlight text or press{' '}
                <kbd className="px-1 py-0.5 text-xxs font-mono bg-neutral-100 border border-neutral-300 rounded text-neutral-700 shadow-2xs">
                  Ctrl+Shift+S
                </kbd>
              </span>
            </div>
          )}
        </div>

        {/* Voice and speed badge */}
        <button
          type="button"
          onClick={() => navigate('/preferences')}
          aria-label="Change voice and speech settings"
          title="Change voice and speech settings"
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xxs font-medium bg-neutral-100 hover:bg-neutral-200/80 active:bg-neutral-200 text-neutral-700 border border-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Sliders size={11} className="text-neutral-500" />
          <span className="truncate max-w-[90px]">{displayVoiceName}</span>
          <span className="text-neutral-400">·</span>
          <span>{speed}×</span>
        </button>
      </div>
    </section>
  )
}
