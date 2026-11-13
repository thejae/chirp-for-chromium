import React from 'react'
import { useSync } from '../../../hooks/useSync.js'

/**
 * Extension behavior settings view, allowing users to toggle automatic
 * read-aloud when highlighting text on any webpage.
 */
export function Settings() {
  const { sync, setSync, ready } = useSync()

  if (!ready) {
    return (
      <div className="text-xs text-neutral-500 py-6 text-center">
        Loading settings…
      </div>
    )
  }

  const autoReadAloud = sync.autoReadAloud !== false
  const highlightSpokenWords = sync.highlightSpokenWords !== false
  const showMiniPlayer = sync.showMiniPlayer !== false
  const showSelectionToolbar = sync.showSelectionToolbar !== false

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight mb-2 ml-0.5">
          Settings
        </h2>
        <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-3.5 divide-y divide-neutral-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="auto-read-aloud-toggle"
                className="text-xs font-medium text-neutral-800 cursor-pointer"
              >
                Auto-read highlighted text on open
              </label>
              <p className="text-xxs text-neutral-500 leading-relaxed">
                Automatically start reading aloud any highlighted text on the
                active page when you click the extension icon to open this
                popup.
              </p>
            </div>
            <button
              id="auto-read-aloud-toggle"
              type="button"
              role="switch"
              aria-checked={autoReadAloud}
              onClick={() =>
                setSync({ ...sync, autoReadAloud: !autoReadAloud })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                autoReadAloud
                  ? 'bg-blue-600 border-transparent'
                  : 'bg-neutral-200 border-neutral-400'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
                  autoReadAloud ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3.5">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="highlight-spoken-words-toggle"
                className="text-xs font-medium text-neutral-800 cursor-pointer"
              >
                Highlight spoken words on page
              </label>
              <p className="text-xxs text-neutral-500 leading-relaxed">
                Highlight the active sentence and word being spoken on the
                webpage, and restore your original selection when finished.
              </p>
            </div>
            <button
              id="highlight-spoken-words-toggle"
              type="button"
              role="switch"
              aria-checked={highlightSpokenWords}
              onClick={() =>
                setSync({
                  ...sync,
                  highlightSpokenWords: !highlightSpokenWords,
                })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                highlightSpokenWords
                  ? 'bg-blue-600 border-transparent'
                  : 'bg-neutral-200 border-neutral-400'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
                  highlightSpokenWords ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3.5">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="show-mini-player-toggle"
                className="text-xs font-medium text-neutral-800 cursor-pointer"
              >
                Show persistent audio player
              </label>
              <p className="text-xxs text-neutral-500 leading-relaxed">
                Display a persistent player bar at the bottom of the popup with
                Play/Pause, sentence progress, and quick playback controls.
              </p>
            </div>
            <button
              id="show-mini-player-toggle"
              type="button"
              role="switch"
              aria-checked={showMiniPlayer}
              onClick={() =>
                setSync({
                  ...sync,
                  showMiniPlayer: !showMiniPlayer,
                })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                showMiniPlayer
                  ? 'bg-blue-600 border-transparent'
                  : 'bg-neutral-200 border-neutral-400'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
                  showMiniPlayer ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3.5">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="show-selection-toolbar-toggle"
                className="text-xs font-medium text-neutral-800 cursor-pointer"
              >
                Show floating selection toolbar
              </label>
              <p className="text-xxs text-neutral-500 leading-relaxed">
                Show a compact Read, Pause/Stop, and Download pill near text you
                highlight on webpages.
              </p>
            </div>
            <button
              id="show-selection-toolbar-toggle"
              type="button"
              role="switch"
              aria-checked={showSelectionToolbar}
              onClick={() =>
                setSync({
                  ...sync,
                  showSelectionToolbar: !showSelectionToolbar,
                })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                showSelectionToolbar
                  ? 'bg-blue-600 border-transparent'
                  : 'bg-neutral-200 border-neutral-400'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
                  showSelectionToolbar ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
