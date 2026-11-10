import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart,
  Box,
  CreditCard,
  GitHub,
  HelpCircle,
  Key,
  Settings,
  Sliders,
  Star,
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

  const sandboxDisabled =
    (sync.mode === 'free' && !sync.apiKeyValid) ||
    (sync.mode === 'paid' && !sync.user?.credits)
  const usageDisabled = sync.mode === 'free' || !sync.user

  return (
    <nav
      aria-label="Extension navigation"
      className="flex flex-col w-44 shrink-0 p-2 py-2.5 border-r border-neutral-200 bg-white/80"
    >
      <div className="flex items-center mb-3.5 px-2 pt-0.5">
        <img
          src="../../public/images/icon_128.png"
          alt="Chirp3 for Chromium icon"
          className="mr-2 shrink-0"
          style={{ width: '24px', height: '24px' }}
        />
        <div className="leading-tight text-left">
          <div className="text-sm font-bold text-neutral-900 tracking-tight">
            Chirp3
          </div>
          <div className="text-xxs font-medium text-neutral-500 -mt-0.5">
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
          disabledReason="Add a valid API key or purchase credits to test voices in the Sandbox"
        >
          Sandbox
        </Sidebar.Item>
        <Sidebar.Item
          Icon={sync.mode === 'paid' ? CreditCard : Key}
          color="bg-emerald-600"
          to="/billing"
        >
          {sync.mode === 'paid' ? 'Billing' : 'Credentials'}
        </Sidebar.Item>
        <Sidebar.Item
          Icon={BarChart}
          color="bg-sky-500"
          to="/usage"
          disabled={usageDisabled}
          disabledReason="Usage history is available when signed in with purchased credits"
        >
          Usage
        </Sidebar.Item>
        <Sidebar.Item Icon={Settings} color="bg-amber-600" to="/settings">
          Settings
        </Sidebar.Item>
        <Sidebar.Item Icon={Terminal} color="bg-slate-600" to="/logs">
          Log
        </Sidebar.Item>
      </div>

      <div className="mt-auto pt-2 border-t border-neutral-200/80 flex flex-col gap-0.5">
        <Sidebar.Item
          Icon={HelpCircle}
          color="bg-neutral-500"
          to="https://wavenet-for-chrome.com/changelog"
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
        <Sidebar.Item
          Icon={Star}
          color="bg-amber-500"
          to="https://chrome.google.com/webstore/detail/wavenet-for-chrome/iefankigbnlnlaolflbcopliocibkffc?hl=en"
        >
          Leave a review
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

    if (to.startsWith('http')) {
      return chrome.tabs.create({ url: to })
    }

    navigate(to)
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
        !active && 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80',
        active && 'bg-neutral-200/75 text-neutral-900 font-semibold',
        disabled && 'opacity-45 cursor-not-allowed hover:bg-transparent hover:text-neutral-600',
      )}
    >
      <div className={`p-1 rounded mr-2 text-white shrink-0 ${color}`}>
        <Icon size={13} className="group-hover:animate-wiggle" />
      </div>
      <div className="truncate">{children}</div>
    </button>
  )
}
