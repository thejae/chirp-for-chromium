import React from 'react'
import { Monitor, Moon, Sun } from 'react-feather'
import { useSync } from '../../../hooks/useSync.js'
import { ThemePreference, useTheme } from '../../../hooks/useTheme'

const THEME_OPTIONS: Array<{
  value: ThemePreference
  label: string
  Icon: React.ComponentType<any>
}> = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

/**
 * Extension appearance & behavior settings view, allowing users to configure
 * the light/dark theme (or auto-detect system default) and toggle playback
 * and UI preferences.
 */
export function Settings() {
  const { sync, setSync, ready } = useSync()
  const { themePreference, systemTheme } = useTheme(sync.theme)

  if (!ready) {
    return (
      <div className="text-xs text-neutral-500 dark:text-neutral-400 py-6 text-center">
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
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 tracking-tight mb-2 ml-0.5">
          Appearance
        </h2>
        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
                Theme
              </span>
              <p className="text-xxs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {themePreference === 'system'
                  ? `Auto-detected from your browser/OS (${
                      systemTheme === 'dark' ? 'Dark' : 'Light'
                    }). Applies to both the popup and floating player.`
                  : 'Applies to both the extension popup and the floating selection player.'}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Extension theme"
              className="inline-flex shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 border border-neutral-200 dark:border-neutral-700"
            >
              {THEME_OPTIONS.map(({ value, label, Icon }) => {
                const selected = themePreference === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSync({ ...sync, theme: value })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xxs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      selected
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Icon size={12} className="shrink-0" />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 tracking-tight mb-2 ml-0.5">
          Settings
        </h2>
        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800 flex flex-col gap-3.5 divide-y divide-neutral-100 dark:divide-neutral-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="auto-read-aloud-toggle"
                className="text-xs font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
              >
                Auto-read highlighted text on open
              </label>
              <p className="text-xxs text-neutral-500 dark:text-neutral-400 leading-relaxed">
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
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900 ${
                autoReadAloud
                  ? 'bg-blue-600 border-transparent'
                  : 'bg-neutral-200 border-neutral-400 dark:bg-neutral-700 dark:border-neutral-500'
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
                className="text-xs font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
              >
                Highlight spoken words on page
              </label>
              <p className="text-xxs text-neutral-500 dark:text-neutral-400 leading-relaxed">
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
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900 ${
                highlightSpokenWords
                  ? 'bg-blue-600 border-transparent'
                  : 'bg-neutral-200 border-neutral-400 dark:bg-neutral-700 dark:border-neutral-500'
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
                className="text-xs font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
              >
                Show persistent audio player
              </label>
              <p className="text-xxs text-neutral-500 dark:text-neutral-400 leading-relaxed">
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
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900 ${
                showMiniPlayer
                  ? 'bg-blue-600 border-transparent'
                  : 'bg-neutral-200 border-neutral-400 dark:bg-neutral-700 dark:border-neutral-500'
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
                className="text-xs font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
              >
                Show floating selection toolbar
              </label>
              <p className="text-xxs text-neutral-500 dark:text-neutral-400 leading-relaxed">
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
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900 ${
                showSelectionToolbar
                  ? 'bg-blue-600 border-transparent'
                  : 'bg-neutral-200 border-neutral-400 dark:bg-neutral-700 dark:border-neutral-500'
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
