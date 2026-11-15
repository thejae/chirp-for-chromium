import * as React from 'react'
import { useEffect, useId, useRef } from 'react'
import { useOutsideClick } from '../hooks/useOutsideClick'

type DialogProps = {
  title: string
  content: React.ReactNode
  onClose: () => void
  buttons?: React.ReactNode
}

/**
 * Accessible modal dialog with focus trapping, previous focus restoration,
 * Escape key dismissal, backdrop click handling, and ARIA dialog semantics.
 * Works inside both the extension popup and the injected content-script Shadow DOM.
 */
export function Dialog({
  title,
  content,
  onClose,
  buttons,
  ...args
}: DialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const outsideClickRef = useOutsideClick(onClose)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector)
    if (focusable && focusable.length > 0) {
      focusable[0].focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const elements = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
        ).filter((el) => el.offsetParent !== null)

        if (elements.length === 0) {
          event.preventDefault()
          return
        }

        const first = elements[0]
        const last = elements[elements.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  return (
    <div
      style={{ zIndex: Number.MAX_SAFE_INTEGER }}
      className="fixed flex w-full h-screen justify-center items-center left-0 top-0 bg-neutral-900/30 dark:bg-black/60 backdrop-blur-sm p-4"
      {...args}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width: 500, maxWidth: '90vw' }}
        ref={(node) => {
          dialogRef.current = node
          outsideClickRef.current = node
        }}
        className="border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 h-fit rounded-xl shadow-xl animate-popup"
      >
        <div className="flex px-6 pt-5 pb-0">
          <div className="w-full">
            <h1
              id={titleId}
              className="text-base mb-2.5 tracking-tight text-neutral-900 dark:text-neutral-100 font-semibold"
            >
              {title}
            </h1>
            <div className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300 break-words">
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
