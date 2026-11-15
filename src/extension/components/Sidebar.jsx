import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  GitHub,
  HelpCircle,
  Key,
  Settings,
  Sliders,
  Terminal,
} from 'react-feather'
import { twMerge } from 'tailwind-merge'
import { useSync } from '../../hooks/useSync'

/**
 * Compact primary navigation sidebar for the extension popup.
 */
export function Sidebar() {
  const { sync, ready } = useSync()

  if (!ready) return null

  const sandboxDisabled = !sync.apiKeyValid

  return (
    <nav
      aria-label="Extension navigation"
      className="flex flex-col w-44 shrink-0 p-2 py-2.5 border-r border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/90"
    >
      <div className="flex items-center mb-3.5 px-2 pt-0.5">
        <img
          src="../../public/images/icon_128.png"
          alt="Chirp3 for Chromium icon"
          className="mr-2 shrink-0"
          style={{ width: '24px', height: '24px' }}
        />
        <div className="leading-tight text-left">
          <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Chirp3
          </div>
          <div className="text-xxs font-medium text-neutral-500 dark:text-neutral-400 -mt-0.5">
            for Chromium
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <Sidebar.Item Icon={Sliders} color="bg-indigo-500" to="/preferences">
          Voice & speech
        </Sidebar.Item>
        <Sidebar.Item
          Icon={Box}
          color="bg-purple-500"
          to="/sandbox"
          disabled={sandboxDisabled}
          disabledReason="Add a valid Google Cloud API key to test voices in the Sandbox"
        >
          Sandbox
        </Sidebar.Item>
        <Sidebar.Item
          Icon={Key}
          color="bg-emerald-600"
          to="/credentials"
        >
          Credentials
        </Sidebar.Item>
        <Sidebar.Item Icon={Settings} color="bg-amber-600" to="/settings">
          Settings
        </Sidebar.Item>
        <Sidebar.Item Icon={Terminal} color="bg-slate-600" to="/logs">
          Log
        </Sidebar.Item>
      </div>

      <div className="mt-auto pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex flex-col gap-0.5">
        <Sidebar.Item
          Icon={HelpCircle}
          color="bg-neutral-500"
          to="https://github.com/thejae/chirp-for-chromium/blob/master/CHANGELOG.md"
        >
          Changelog
        </Sidebar.Item>
        <Sidebar.Item
          Icon={GitHub}
          color="bg-neutral-700"
          to="https://github.com/thejae/chirp-for-chromium"
        >
          Contribute
        </Sidebar.Item>
      </div>
    </nav>
  )
}

Sidebar.Item = function Item({
  Icon,
  children,
  to,
  color,
  onClick,
  disabled,
  disabledReason,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const active = location.pathname === to

  function handleClick() {
    if (disabled) {
      return
    }

    navigate(to)
  }

  if (to.startsWith('http')) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={twMerge(
          'px-1.5 py-1.5 flex items-center group text-xs font-medium rounded-md cursor-pointer transition-colors w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800/80',
        )}
      >
        <div className={`p-1 rounded mr-2 text-white shrink-0 ${color}`}>
          <Icon size={13} className="group-hover:animate-wiggle" />
        </div>
        <div className="truncate">{children}</div>
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={onClick || handleClick}
      className={twMerge(
        'px-1.5 py-1.5 flex items-center group text-xs font-medium rounded-md cursor-pointer transition-colors w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        !active &&
          'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800/80',
        active &&
          'bg-neutral-200/75 text-neutral-900 font-semibold dark:bg-neutral-800 dark:text-neutral-100',
        disabled &&
          'opacity-45 cursor-not-allowed hover:bg-transparent hover:text-neutral-600 dark:hover:bg-transparent dark:hover:text-neutral-400',
      )}
    >
      <div className={`p-1 rounded mr-2 text-white shrink-0 ${color}`}>
        <Icon size={13} className="group-hover:animate-wiggle" />
      </div>
      <div className="truncate">{children}</div>
    </button>
  )
}
