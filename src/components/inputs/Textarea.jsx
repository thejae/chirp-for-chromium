import React, { useId } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * Accessible multi-line textarea control with bound floating label and
 * inline validation error message.
 */
export function Textarea(props) {
  const textareaId = useId()
  const errorId = `${textareaId}-error`

  function handleChange(e) {
    const nextValue = e?.currentTarget?.value
    if (props.onChange) props.onChange(nextValue)
  }

  return (
    <div className="relative font-medium text-xs flex flex-col grow">
      <label
        htmlFor={textareaId}
        className={twMerge(
          'bg-white absolute text-xxs font-medium -top-2 left-2 px-1 text-neutral-600 z-10',
          props.error && 'text-red-600',
        )}
      >
        {props.label}
      </label>

      <textarea
        id={textareaId}
        aria-invalid={Boolean(props.error)}
        aria-describedby={props.error ? errorId : undefined}
        className={twMerge(
          'border border-neutral-200 h-full px-3 py-2.5 outline-none rounded-md w-full text-neutral-900 bg-white leading-relaxed resize-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15',
          props.error &&
            'border-red-400 focus:border-red-500 focus:ring-red-500/15',
        )}
        placeholder={props.placeholder}
        value={props.value ?? ''}
        onChange={handleChange}
        disabled={props.disabled}
      />

      {props.error && (
        <span
          id={errorId}
          role="alert"
          className="block text-red-600 text-xxs pl-1 pt-1 font-medium"
        >
          {props.error}
        </span>
      )}
    </div>
  )
}
