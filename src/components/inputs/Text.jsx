import React, { useId, useState } from 'react'
import { Eye, EyeOff } from 'react-feather'
import { twMerge } from 'tailwind-merge'

/**
 * Accessible single-line text or password input with floating label, inline
 * validation state, and optional secret visibility toggle.
 */
export function Text(props) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const isPassword = props.type === 'password'
  const [revealed, setRevealed] = useState(false)

  function handleChange(e) {
    const nextValue = e?.currentTarget?.value
    if (props.onChange) props.onChange(nextValue)
  }

  const inputType = isPassword ? (revealed ? 'text' : 'password') : 'text'

  return (
    <div className="relative font-medium text-xs">
      <label
        htmlFor={inputId}
        className={twMerge(
          'bg-white dark:bg-neutral-900 absolute text-xxs font-medium -top-2 left-2 px-1 text-neutral-600 dark:text-neutral-400 z-10',
          props.error && 'text-red-600 dark:text-red-400',
        )}
      >
        {props.label}
      </label>

      <div className="relative flex items-center">
        <input
          id={inputId}
          type={inputType}
          aria-invalid={Boolean(props.error)}
          aria-describedby={props.error ? errorId : undefined}
          className={twMerge(
            'border border-neutral-200 dark:border-neutral-700 h-9 px-3 py-1 outline-none rounded-md w-full text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 dark:placeholder:text-neutral-500 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:focus:border-blue-400 dark:focus:ring-blue-400/20',
            isPassword && 'pr-9',
            props.error &&
              'border-red-400 focus:border-red-500 focus:ring-red-500/15 dark:border-red-500/70',
          )}
          placeholder={props.placeholder}
          value={props.value ?? ''}
          onChange={handleChange}
          disabled={props.disabled}
          min={props.min}
          max={props.max}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? 'Hide API key' : 'Show API key'}
            title={revealed ? 'Hide API key' : 'Show API key'}
            className="absolute right-2 p-1 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>

      {props.error && (
        <span
          id={errorId}
          role="alert"
          className="block text-red-600 dark:text-red-400 text-xxs pl-1 pt-1 font-medium"
        >
          {props.error}
        </span>
      )}
    </div>
  )
}
