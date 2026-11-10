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

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight mb-2 ml-0.5">
          Settings
        </h2>
        <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="auto-read-aloud-toggle"
                className="text-xs font-medium text-neutral-800 cursor-pointer"
              >
                Auto-read highlighted text
              </label>
              <p className="text-xxs text-neutral-500 leading-relaxed">
                Automatically read aloud any text you highlight in the browser.
                Toggle off to read only when triggered manually.
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
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                autoReadAloud ? 'bg-blue-600' : 'bg-neutral-300'
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
        </div>
      </div>
    </div>
  )
}
