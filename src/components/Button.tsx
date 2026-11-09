import React from 'react'
import { Loader } from 'react-feather'
import { twMerge } from 'tailwind-merge'

type ButtonProps = {
  children?: React.ReactNode
  submitting?: boolean
  Icon?: React.ComponentType<any>
  type?: 'default' | 'primary' | 'secondary' | 'danger' | 'success' | 'warning'
  htmlType?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  ping?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  className?: string
  title?: string
}

/**
 * Shared button control with loading indicator, optional status ping ring,
 * and keyboard focus styling.
 */
export function Button({
  children,
  submitting,
  Icon,
  type = 'default',
  htmlType = 'button',
  className,
  disabled,
  ping,
  ...args
}: ButtonProps) {
  return (
    <button
      type={htmlType}
      disabled={submitting || disabled}
      className={twMerge(
        buttonColorMap[type],
        'flex items-center justify-center rounded-md px-3.5 py-2 select-none border text-xs font-medium shadow-sm w-full relative transition-all duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
        (submitting || disabled) && 'opacity-50 cursor-not-allowed active:scale-100',
        className,
      )}
      {...args}
    >
      {Icon && !submitting && (
        <Icon className="mr-1.5 shrink-0 pointer-events-none" size={15} />
      )}
      {submitting && (
        <Loader size={15} className="mr-1.5 shrink-0 animate-spin" />
      )}
      <span className="flex items-center justify-center text-center w-full relative whitespace-nowrap pointer-events-none">
        {children}
      </span>
      {Boolean(ping) && (
        <span
          aria-hidden="true"
          className={twMerge(
            'w-full h-full absolute top-0 left-0 rounded-md -z-10 pointer-events-none animate-ping-sm',
            buttonColorMap[type],
          )}
        />
      )}
    </button>
  )
}

const buttonColorMap = {
  default:
    'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900',
  primary:
    'bg-blue-600 text-white border-blue-700 hover:bg-blue-700',
  secondary:
    'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200',
  danger:
    'bg-red-600 text-white border-red-700 hover:bg-red-700',
  success:
    'bg-green-600 text-white border-green-700 hover:bg-green-700',
  warning:
    'bg-amber-600 text-white border-amber-700 hover:bg-amber-700',
}
