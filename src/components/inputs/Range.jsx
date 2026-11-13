import React, { useEffect, useId } from 'react'
import { RotateCcw } from 'react-feather'
import { twMerge } from 'tailwind-merge'
import { useDebounce } from '../../hooks/useDebounce'

/**
 * Accessible range slider with live tabular value readout, optional preset
 * chips, and one-click reset to default.
 */
export function Range(props) {
  const inputId = useId()
  const listId = `${inputId}-list`
  const [value, setValue] = React.useState(props.value ?? 0)
  const debouncedValue = useDebounce(value, 300)
  const min = props.min ?? 0
  const max = props.max ?? 100
  const defaultValue = props.defaultValue
  const isModified =
    defaultValue !== undefined && Number(value) !== Number(defaultValue)

  useEffect(() => {
    if (props.value !== undefined && Number(props.value) !== Number(value)) {
      setValue(props.value)
    }
  }, [props.value])

  useEffect(() => {
    props.onChange(debouncedValue)
  }, [debouncedValue])

  function applyValue(nextVal) {
    setValue(nextVal)
    props.onChange(nextVal)
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="font-medium text-neutral-700 dark:text-neutral-200">
          {props.label}
        </label>
        <div className="flex items-center gap-1.5">
          {isModified && (
            <button
              type="button"
              onClick={() => applyValue(defaultValue)}
              title={`Reset to ${defaultValue}${props.unit || ''}`}
              className="flex items-center gap-0.5 text-xxs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/60 font-medium px-1 py-0.5 rounded transition-colors"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          )}
          <span className="font-semibold text-neutral-800 bg-neutral-100 dark:text-neutral-200 dark:bg-neutral-800 tabular-nums px-1.5 py-0.5 rounded text-xxs min-w-[3rem] text-center">
            {value.toString()}
            {props.unit || ''}
          </span>
        </div>
      </div>
      <div className="w-full flex items-center">
        <input
          id={inputId}
          name={props.name || inputId}
          className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
          type="range"
          min={min}
          max={max}
          step={props.step || 1}
          value={value}
          list={listId}
          onChange={(e) => setValue(Number(e.currentTarget.value))}
        />
        {props.ticks && (
          <datalist id={listId}>
            {props.ticks.map((tick, index) => (
              <option key={`tick-${index}`} value={tick} />
            ))}
          </datalist>
        )}
      </div>
      {props.presets && (
        <div className="flex items-center gap-1.5 pt-0.5">
          {props.presets.map((preset) => {
            const active = Number(value) === Number(preset)
            return (
              <button
                key={`preset-${preset}`}
                type="button"
                onClick={() => applyValue(preset)}
                className={twMerge(
                  'flex-1 py-1 px-2 rounded text-xxs font-medium tabular-nums transition-colors border text-center',
                  active
                    ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 dark:bg-neutral-800/70 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-800',
                )}
              >
                {preset}
                {props.unit || ''}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
