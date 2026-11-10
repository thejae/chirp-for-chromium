import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { GitHub } from 'react-feather'
import { useState } from 'react'
import { Dialog } from '../components/Dialog'
import { OnboardingDialog } from './components/dialogs/OnboardingDialog'
import { Button } from '../components/Button'
import { useMount } from '../hooks/useMount'
import { useSync } from '../hooks/useSync'
import {
  TError,
  createGithubIssueFromError,
  isError,
} from './helpers/error-helpers'

// Event listeners -------------------------------------------------------------
window.addEventListener('load', function () {
  console.log('load')

  const root = document.createElement('div')
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
})

function getSelectedText(): string {
  const active = document.activeElement as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    const start = active.selectionStart ?? 0
    const end = active.selectionEnd ?? 0
    return (active.value || '').slice(start, end).trim()
  }
  return (window.getSelection()?.toString() || '').trim()
}

// React component -------------------------------------------------------------
function ContentScript() {
  const { sync, ready } = useSync()
  const [error, setError] = useState<null | TError>(null)

  async function handleMessages(request, sender, sendResponse) {
    console.log('Handling message...', request, sender, sendResponse)

    if (!request) {
      return
    }

    if (isError(request)) {
      setError(request)

      return
    }
  }

  useMount(function () {
    chrome.runtime.onMessage.addListener(handleMessages)

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let lastReadText = ''

    function scheduleAutoRead() {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        const text = getSelectedText()
        if (!text) {
          lastReadText = ''
          return
        }
        if (text.length < 2 || text === lastReadText) return

        const currentSync = await chrome.storage.sync.get()
        if (currentSync.autoReadAloud === false) return

        const hasCredentials =
          (currentSync.mode === 'free' && Boolean(currentSync.apiKey)) ||
          (currentSync.mode === 'paid' && Boolean(currentSync.user?.credits))
        if (!hasCredentials) return

        lastReadText = text
        chrome.runtime.sendMessage({ id: 'readAloud', payload: { text } })
      }, 300)
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === 'Shift' || event.shiftKey) {
        scheduleAutoRead()
      }
    }

    document.addEventListener('mouseup', scheduleAutoRead)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      document.removeEventListener('mouseup', scheduleAutoRead)
      document.removeEventListener('keyup', handleKeyUp)
      chrome.runtime.onMessage.removeListener(handleMessages)
    }
  })

  if (!error || !ready) {
    return null
  }

  if (
    error.errorCode === 'MISSING_API_KEY' ||
    (sync.user && !sync.user.credits)
  ) {
    return <OnboardingDialog onClose={() => setError(null)} />
  }

  return (
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
