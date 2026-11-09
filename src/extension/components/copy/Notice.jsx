import React from 'react'
import { isError } from '../../helpers/error-helpers'
import { useStore } from '../../../hooks/useStore'
import { errorStore } from '../../extension'

export const Notice = () => {
  const [, setError] = useStore(errorStore, { rerenderOnEffect: false })

  async function handleAuthentication() {
    const response = await chrome.runtime.sendMessage({ id: 'authenticate' })

    if (isError(response)) setError(response)
  }

  return (
    <div className="flex flex-col gap-2.5 text-xs leading-relaxed text-neutral-700">
      <p>
        Chirp3 for Chromium is an{' '}
        <a
          className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2"
          href="https://github.com/thejae/chirp-for-chromium"
          target="_blank"
          rel="noreferrer"
        >
          open-source extension
        </a>{' '}
        powered by Google Cloud Text-to-Speech. Purchase prepaid credits for
        one-click setup, or connect your own Google Cloud API key.
      </p>
      <p className="text-neutral-600">
        Already purchased credits?{' '}
        <button
          type="button"
          className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          onClick={handleAuthentication}
        >
          Re-sync your account
        </button>
        .
      </p>
    </div>
  )
}

export const FreeNotice = () => (
  <div className="flex flex-col gap-1.5 mb-3 text-xs leading-relaxed text-neutral-700">
    <p>
      Enter your Google Cloud API key to synthesize speech using your own Google
      Cloud project. Follow the{' '}
      <a
        className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2"
        href="https://www.youtube.com/watch?v=1n8xlVNWEZ0"
        target="_blank"
        rel="noreferrer"
      >
        step-by-step setup guide
      </a>{' '}
      to create a key.
    </p>
  </div>
)

export const HowToUseTip = () => (
  <div className="bg-blue-50/70 border border-blue-200/80 rounded-md px-3 py-2 text-xxs text-blue-900 leading-relaxed">
    <span className="font-semibold">How to read any webpage:</span> Highlight
    text on any page and right-click → <span className="font-semibold">Read aloud</span>, or press{' '}
    <kbd className="px-1 py-0.5 bg-white border border-blue-200 rounded font-mono text-xxs">
      Ctrl+Shift+S
    </kbd>{' '}
    (<kbd className="px-1 py-0.5 bg-white border border-blue-200 rounded font-mono text-xxs">⌘+Shift+S</kbd> on Mac).
  </div>
)
