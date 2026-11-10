import React from 'react'
import { useSync } from '../hooks/useSync'
import { useMount } from '../hooks/useMount'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Billing } from './components/views/Billing'
import { Usage } from './components/views/Usage'
import { Preferences } from './components/views/Preferences'
import { Sandbox } from './components/views/Sandbox'
import { Logs } from './components/views/Logs'
import { Settings } from './components/views/Settings'
import { MiniPlayer } from './components/player/MiniPlayer'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { GitHub } from 'react-feather'
import {
  TError,
  createGithubIssueFromError,
  isError,
} from './helpers/error-helpers'
import { createStore, useStore } from '../hooks/useStore'

export const errorStore = createStore<null | TError>(null)

/**
 * Root popup container for the extension.
 * Opens the "Voice & speech" (`/preferences`) tab by default on launch
 * and renders the global error dialog when runtime errors occur.
 */
export function Extension() {
  const navigate = useNavigate()
  const { sync, ready } = useSync()
  const [error, setError] = useStore(errorStore)

  useMount(() => {
    // Default to the Voice & speech tab whenever the popup opens
    navigate('/preferences')

    // Fetch voices in-case the session has become invalid
    chrome.runtime.sendMessage({ id: 'fetchVoices' })

    // Automatically read aloud highlighted text on popup open if enabled in Settings
    chrome.runtime
      .sendMessage({ id: 'autoReadOnPopupOpen' })
      .then((response) => {
        if (isError(response)) setError(response)
      })
  })

  if (!ready) {
    return (
      <div
        style={{ width: 586, height: 550 }}
        className="bg-neutral-50 flex items-center justify-center text-xs text-neutral-500"
      >
        Loading extension…
      </div>
    )
  }

  return (
    <div
      style={{ width: 586, height: 550 }}
      className="bg-neutral-50 flex text-neutral-800"
    >
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 p-4 overflow-y-auto bg-neutral-100/60">
          <Routes>
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/sandbox" element={<Sandbox />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </main>
        {sync.showMiniPlayer !== false && <MiniPlayer />}
      </div>
      {error && (
        <Dialog
          title={error.errorTitle}
          content={error.errorMessage}
          onClose={() => setError(null)}
          buttons={[
            <Button
              key="create-issue-button"
              className="max-w-fit"
              Icon={GitHub}
              onClick={() => createGithubIssueFromError(error)}
            >
              Report issue
            </Button>,
            <Button
              key="close-button"
              className="max-w-fit"
              type="primary"
              onClick={() => setError(null)}
            >
              Close
            </Button>,
          ]}
        />
      )}
    </div>
  )
}
