import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader, Pause, Play, Square } from 'react-feather'
import { useSession } from '../../../hooks/useSession'
import { TError, isError } from '../../helpers/error-helpers'

type SelectionToolbarProps = {
  /** Whether the floating selection toolbar is enabled in user settings. */
  enabled: boolean
  /** Callback invoked when playback or download returns a structured extension error. */
  onError: (error: TError) => void
}

type ToolbarPosition = {
  top: number
  left: number
  placement: 'above' | 'below'
}

const VIEWPORT_PADDING = 10
const TOOLBAR_ESTIMATED_HEIGHT = 36
const TOOLBAR_ESTIMATED_HALF_WIDTH = 72

/**
 * Slim, pill-shaped floating toolbar (Option 4H-5) anchored near the user's
 * active webpage text selection.
 *
 * Shows a compact "Read" pill and download action when idle, then collapses
 * into icon-only Pause/Resume, Stop, and Download controls during playback.
 * A 2px gradient progress bar along the bottom edge tracks progress across the
 * entirety of the selected text (weighted by character length across all chunks
 * plus intra-chunk playback time).
 */
export function SelectionToolbar({ enabled, onError }: SelectionToolbarProps) {
  const { session, ready } = useSession()
  const [selectedText, setSelectedText] = useState('')
  const [position, setPosition] = useState<ToolbarPosition | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [chunkElapsed, setChunkElapsed] = useState(0)
  const lastChunkIndexRef = useRef<number>(-1)

  const isPlaying = Boolean(session?.playing)
  const isPaused = Boolean(session?.paused)
  const currentChunkIndex = Number(session?.currentChunkIndex || 0)
  const currentChunkDuration = Number(session?.currentChunkDuration || 0)
  const totalChars = Number(session?.totalChars || 0)
  const completedChars = Number(session?.completedChars || 0)
  const activeChunkChars = String(session?.activeChunkText || '').length

  // Reset intra-chunk elapsed timer when advancing to a new chunk or stopping
  useEffect(() => {
    if (!isPlaying) {
      lastChunkIndexRef.current = -1
      setChunkElapsed(0)
      return
    }
    if (lastChunkIndexRef.current !== currentChunkIndex) {
      lastChunkIndexRef.current = currentChunkIndex
      setChunkElapsed(0)
    }
  }, [isPlaying, currentChunkIndex])

  // Advance intra-chunk elapsed time smoothly while audio is actively playing
  useEffect(() => {
    if (!isPlaying || isPaused || currentChunkDuration <= 0) {
      return
    }

    const tickMs = 100
    const timer = window.setInterval(() => {
      setChunkElapsed((prev) =>
        Math.min(currentChunkDuration, prev + tickMs / 1000),
      )
    }, tickMs)

    return () => window.clearInterval(timer)
  }, [isPlaying, isPaused, currentChunkDuration, currentChunkIndex])

  // Compute progress across the entire selection length (all chunks combined)
  let progressPercent = 0
  if (isPlaying && totalChars > 0) {
    const intraChunkRatio =
      currentChunkDuration > 0
        ? Math.min(1, chunkElapsed / currentChunkDuration)
        : 0
    const spokenChars = completedChars + intraChunkRatio * activeChunkChars
    progressPercent = Math.min(
      100,
      Math.max(2, Math.round((spokenChars / totalChars) * 100)),
    )
  }

  /**
   * Computes a viewport-clamped fixed position from the current DOM selection
   * bounding box, flipping below the selection when near the top edge.
   */
  const updateFromSelection = useCallback(() => {
    if (!enabled) return

    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''

    if (!text || !selection || selection.rangeCount === 0) {
      if (!isPlaying) {
        setSelectedText('')
        setPosition(null)
      }
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    if (rect.width === 0 && rect.height === 0) {
      if (!isPlaying) {
        setSelectedText('')
        setPosition(null)
      }
      return
    }

    const placeBelow =
      rect.top < TOOLBAR_ESTIMATED_HEIGHT + VIEWPORT_PADDING * 2
    const rawTop = placeBelow
      ? rect.bottom + VIEWPORT_PADDING
      : rect.top - VIEWPORT_PADDING

    const minLeft = TOOLBAR_ESTIMATED_HALF_WIDTH + VIEWPORT_PADDING
    const maxLeft =
      window.innerWidth - TOOLBAR_ESTIMATED_HALF_WIDTH - VIEWPORT_PADDING
    const centerX = rect.left + rect.width / 2
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, centerX))

    setSelectedText(text)
    setPosition({
      top: Math.max(
        VIEWPORT_PADDING,
        Math.min(window.innerHeight - VIEWPORT_PADDING, rawTop),
      ),
      left: clampedLeft,
      placement: placeBelow ? 'below' : 'above',
    })
  }, [enabled, isPlaying])

  useEffect(() => {
    if (!enabled) {
      setSelectedText('')
      setPosition(null)
      return
    }

    let rafId: number | null = null

    function isEventInsideExtension(event: Event): boolean {
      const host = document.getElementById('chirp3-extension-root')
      if (!host) return false
      return event.composedPath().includes(host)
    }

    function scheduleSelectionCheck(event: Event) {
      if (isEventInsideExtension(event)) return
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        updateFromSelection()
      })
    }

    function handleMouseDown(event: MouseEvent) {
      if (isEventInsideExtension(event)) return
      if (!isPlaying) {
        const selectionText = window.getSelection()?.toString().trim() || ''
        if (!selectionText) {
          setSelectedText('')
          setPosition(null)
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPlaying) {
        setSelectedText('')
        setPosition(null)
      }
    }

    document.addEventListener('mouseup', scheduleSelectionCheck)
    document.addEventListener('keyup', scheduleSelectionCheck)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      document.removeEventListener('mouseup', scheduleSelectionCheck)
      document.removeEventListener('keyup', scheduleSelectionCheck)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, isPlaying, updateFromSelection])

  // Clear toolbar when playback finishes if nothing is selected anymore
  useEffect(() => {
    if (!ready || isPlaying) return
    const currentText = window.getSelection()?.toString().trim() || ''
    if (!currentText) {
      setSelectedText('')
      setPosition(null)
    }
  }, [isPlaying, ready])

  async function handlePrimaryAction() {
    if (!isPlaying) {
      const textToRead =
        selectedText || window.getSelection()?.toString().trim() || ''
      if (!textToRead) return

      const response = await chrome.runtime.sendMessage({
        id: 'readAloud',
        payload: { text: textToRead },
      })
      if (isError(response)) {
        onError(response)
      }
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
    const currentText = window.getSelection()?.toString().trim() || ''
    if (!currentText) {
      setSelectedText('')
      setPosition(null)
    }
  }

  async function handleDownload() {
    const textToDownload =
      selectedText || window.getSelection()?.toString().trim() || ''
    if (!textToDownload || downloading) return

    setDownloading(true)
    try {
      const response = await chrome.runtime.sendMessage({
        id: 'download',
        payload: { text: textToDownload },
      })
      if (isError(response)) {
        onError(response)
      }
    } finally {
      setDownloading(false)
    }
  }

  if (!enabled || !ready || !position || (!selectedText && !isPlaying)) {
    return null
  }

  const transformClass =
    position.placement === 'above'
      ? '-translate-x-1/2 -translate-y-full'
      : '-translate-x-1/2'

  return (
    <div
      role="region"
      aria-label="Selection read aloud controls"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 2147483647,
      }}
      className={`${transformClass} animate-popup select-none`}
    >
      <div className="bg-neutral-900 text-white rounded-3xl shadow-xl border border-neutral-700/80 overflow-hidden whitespace-nowrap">
        <div className="flex items-center gap-1 px-1.5 py-1">
          {!isPlaying ? (
            <button
              type="button"
              onClick={handlePrimaryAction}
              aria-label="Read selected text aloud"
              title="Read selected text aloud"
              className="flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Play size={11} className="fill-current shrink-0 ml-0.5" />
              <span>Read</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePrimaryAction}
                aria-label={isPaused ? 'Resume reading' : 'Pause reading'}
                title={isPaused ? 'Resume reading' : 'Pause reading'}
                className="h-6 w-6 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {isPaused ? (
                  <Play size={11} className="fill-current shrink-0 ml-0.5" />
                ) : (
                  <Pause size={11} className="fill-current shrink-0" />
                )}
              </button>
              <button
                type="button"
                onClick={handleStop}
                aria-label="Stop reading"
                title="Stop reading"
                className="h-6 w-6 rounded-full bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-200 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Square size={10} className="fill-current shrink-0" />
              </button>
            </>
          )}

          <div
            className="w-px h-3.5 bg-neutral-700 mx-0.5"
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Download selected text as audio"
            title="Download audio"
            className="h-6 w-6 rounded-full hover:bg-neutral-800 active:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {downloading ? (
              <Loader size={12} className="animate-spin shrink-0" />
            ) : (
              <Download size={12} className="shrink-0" />
            )}
          </button>
        </div>

        {/* Full-selection reading progress bar */}
        <div
          className="h-[2px] w-full bg-neutral-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-label="Reading progress"
        >
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-150 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
