import * as React from 'react'
import { useEffect, useId } from 'react'
import { useMount } from '../hooks/useMount'
import { useOutsideClick } from '../hooks/useOutsideClick'

type DialogProps = {
  title: string
  content: React.ReactNode
  onClose: () => void
  buttons?: React.ReactNode
}

/**
 * Accessible modal dialog with Escape key dismissal, backdrop click handling,
 * and ARIA dialog semantics. Works inside both the extension popup and the
 * injected content-script Shadow DOM.
 */
export function Dialog({
  title,
  content,
  onClose,
  buttons,
  ...args
}: DialogProps) {
  const titleId = useId()
  useMount(() => document.getSelection()?.removeAllRanges())

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      style={{ zIndex: Number.MAX_SAFE_INTEGER }}
      className="fixed flex w-full h-screen justify-center items-center left-0 top-0 bg-neutral-900/30 backdrop-blur-sm p-4"
      {...args}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width: 500, maxWidth: '90vw' }}
        ref={useOutsideClick(onClose)}
        className="border border-neutral-200 bg-white h-fit rounded-xl shadow-xl animate-popup"
      >
        <div className="flex px-6 pt-5 pb-0">
          <div className="w-full">
            <h1
              id={titleId}
              className="text-base mb-2.5 tracking-tight text-neutral-900 font-semibold"
            >
              {title}
            </h1>
            <div className="text-xs leading-relaxed text-neutral-600 break-words">
              {content}
            </div>
          </div>
        </div>
        {buttons && (
          <div className="flex justify-end gap-2.5 p-6 pt-4">{buttons}</div>
        )}
      </div>
    </div>
  )
}
