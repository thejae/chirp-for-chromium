import React from 'react'
import { creditFormat, dateFormat } from '../../helpers/formatting-helpers.js'
import { useMount } from '../../../hooks/useMount.js'

/**
 * Credit balance and synthesis history ledger for paid-mode accounts.
 */
export function Usage() {
  const [user, setUser] = React.useState(null)
  const [loadingUser, setLoadingUser] = React.useState(true)

  const [usage, setUsage] = React.useState([])
  const [loadingUsage, setLoadingUsage] = React.useState(true)

  useMount(() => {
    setLoadingUser(true)
    setLoadingUsage(true)
    chrome.runtime.sendMessage({ id: 'fetchUser' }, (response) => {
      setLoadingUser(false)
      if (!response) return

      setUser(response)
    })

    chrome.runtime.sendMessage({ id: 'fetchUsage' }, (response) => {
      setLoadingUsage(false)
      if (!response) return

      setUsage(response)
    })
  })

  function renderCredits() {
    return (
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 tracking-tight mb-2 ml-0.5">
          Credit balance
        </h2>
        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
          <span className="text-neutral-600 dark:text-neutral-400">Remaining credits</span>
          {loadingUser ? (
            <span className="text-neutral-400 dark:text-neutral-500">Loading balance…</span>
          ) : (
            <span className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums text-sm">
              {creditFormat(user?.credits || 0)}
            </span>
          )}
        </div>
      </div>
    )
  }

  function renderUsage() {
    return (
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 tracking-tight mb-2 ml-0.5">
          Recent syntheses (last 100)
        </h2>
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200/70 dark:divide-neutral-800 flex flex-col overflow-hidden text-xs">
          {loadingUsage ? (
            <div className="p-4 text-neutral-500 dark:text-neutral-400 text-center">
              Loading usage history…
            </div>
          ) : usage.length ? (
            usage.map((u, idx) => (
              <UsageItem key={u.id || `${u.inserted_at}-${idx}`} {...u} />
            ))
          ) : (
            <div className="p-4 text-neutral-500 dark:text-neutral-400 text-center">
              No synthesis usage recorded yet. Highlight text on any page and
              choose <span className="font-medium text-neutral-700 dark:text-neutral-200">Read aloud</span> to start.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {renderCredits()}
      {renderUsage()}
    </div>
  )
}

function UsageItem(props) {
  return (
    <div className="flex items-center px-3.5 py-2.5 even:bg-neutral-50/70 dark:even:bg-neutral-800/40 gap-3">
      <div className="text-neutral-600 dark:text-neutral-400 tabular-nums">
        {dateFormat(props.inserted_at)}
      </div>
      <div className="ml-auto font-medium text-neutral-900 dark:text-neutral-100 tabular-nums">
        {Number(props.character_count || 0).toLocaleString()} chars
      </div>
      <div className="text-xxs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded">
        {props.voice_name}
      </div>
    </div>
  )
}
