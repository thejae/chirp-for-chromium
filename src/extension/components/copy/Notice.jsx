import React from 'react'

export const FreeNotice = () => (
  <div className="flex flex-col gap-1.5 mb-3 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
    <p>
      Enter your Google Cloud API key to synthesize speech using your own Google
      Cloud project. Follow the{' '}
      <a
        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline underline-offset-2"
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
  <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-md px-3 py-2 text-xxs text-blue-900 dark:text-blue-200 leading-relaxed">
    <span className="font-semibold">How to read any webpage:</span> Highlight
    text on any page and right-click → <span className="font-semibold">Read aloud</span>, or press{' '}
    <kbd className="px-1 py-0.5 bg-white dark:bg-neutral-900 border border-blue-200 dark:border-blue-800 rounded font-mono text-xxs">
      Ctrl+Shift+S
    </kbd>{' '}
    (<kbd className="px-1 py-0.5 bg-white dark:bg-neutral-900 border border-blue-200 dark:border-blue-800 rounded font-mono text-xxs">⌘+Shift+S</kbd> on Mac).
  </div>
)
