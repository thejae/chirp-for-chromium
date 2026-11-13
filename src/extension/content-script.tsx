import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { GitHub } from 'react-feather'
import { useState } from 'react'
import { Dialog } from '../components/Dialog'
import { OnboardingDialog } from './components/dialogs/OnboardingDialog'
import { SelectionToolbar } from './components/player/SelectionToolbar'
import { Button } from '../components/Button'
import { useMount } from '../hooks/useMount'
import { useSync } from '../hooks/useSync'
import {
  TError,
  createGithubIssueFromError,
  isError,
} from './helpers/error-helpers'
import {
  endHighlightSession,
  highlightChunk,
  pauseHighlightSession,
  resumeHighlightSession,
  startHighlightSession,
} from './helpers/highlight-helpers'

let setContentError: ((error: TError | null) => void) | null = null

// Register runtime message listener immediately at script evaluation time
// so messages from the service worker are handled even if `window.onload`
// already fired before `document_idle`.
chrome.runtime.onMessage.addListener(function (request) {
  if (!request) return

  if (isError(request)) {
    setContentError?.(request)
    return
  }

  if (request.id === 'highlightSessionStart') {
    startHighlightSession(request.payload)
    return
  }

  if (request.id === 'highlightChunk') {
    highlightChunk(request.payload)
    return
  }

  if (request.id === 'highlightPause') {
    pauseHighlightSession()
    return
  }

  if (request.id === 'highlightResume') {
    resumeHighlightSession()
    return
  }

  if (request.id === 'highlightSessionEnd') {
    endHighlightSession()
    return
  }
})

function mountContentScriptUi() {
  if (!document.body || document.getElementById('chirp3-extension-root')) return

  const root = document.createElement('div')
  root.id = 'chirp3-extension-root'
  const shadowRoot = root.attachShadow({ mode: 'open' })

  // Fetch the CSS file and replace rem values with px values, this is needed
  // so tailwind styles don't inherit the font size from the page.
  fetch(chrome.runtime.getURL('public/styles.css'))
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.text()
    })
    .then((text) => {
      const parsedText = text.replace(/(\d*\.?\d+)rem/g, (match, group) => {
        const pxValue = parseFloat(group) * 16
        return `${pxValue}px`
      })

      const styleEl = document.createElement('style')
      styleEl.textContent = parsedText
      shadowRoot.appendChild(styleEl)

      document.body.appendChild(root)
      createRoot(shadowRoot).render(<ContentScript />)
    })
    .catch((error) => {
      console.error('Failed to load CSS: ', error)
    })
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', mountContentScriptUi, {
    once: true,
  })
} else {
  mountContentScriptUi()
}

// React component -------------------------------------------------------------
function ContentScript() {
  const { sync, ready } = useSync()
  const [error, setError] = useState<null | TError>(null)

  useMount(function () {
    setContentError = setError
    return () => {
      setContentError = null
    }
  })

  if (!ready) {
    return null
  }

  const showSelectionToolbar = sync.showSelectionToolbar !== false
  let errorDialog: React.ReactNode = null

  if (error) {
    if (
      error.errorCode === 'MISSING_API_KEY' ||
      (sync.user && !sync.user.credits)
    ) {
      errorDialog = <OnboardingDialog onClose={() => setError(null)} />
    } else {
      errorDialog = (
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
      )
    }
  }

  return (
    <>
      <SelectionToolbar enabled={showSelectionToolbar} onError={setError} />
      {errorDialog}
    </>
  )
}
