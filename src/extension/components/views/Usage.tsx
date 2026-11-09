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
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight mb-2 ml-0.5">
          Credit balance
        </h2>
        <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex items-center justify-between text-xs">
          <span className="text-neutral-600">Remaining credits</span>
          {loadingUser ? (
            <span className="text-neutral-400">Loading balance…</span>
          ) : (
            <span className="font-bold text-neutral-900 tabular-nums text-sm">
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
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight mb-2 ml-0.5">
          Recent syntheses (last 100)
        </h2>
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 divide-y divide-neutral-200/70 flex flex-col overflow-hidden text-xs">
          {loadingUsage ? (
            <div className="p-4 text-neutral-500 text-center">
              Loading usage history…
            </div>
          ) : usage.length ? (
            usage.map((u, idx) => (
              <UsageItem key={u.id || `${u.inserted_at}-${idx}`} {...u} />
            ))
          ) : (
            <div className="p-4 text-neutral-500 text-center">
              No synthesis usage recorded yet. Highlight text on any page and
              choose <span className="font-medium text-neutral-700">Read aloud</span> to start.
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
    <div className="flex items-center px-3.5 py-2.5 even:bg-neutral-50/70 gap-3">
      <div className="text-neutral-600 tabular-nums">
        {dateFormat(props.inserted_at)}
      </div>
      <div className="ml-auto font-medium text-neutral-900 tabular-nums">
        {Number(props.character_count || 0).toLocaleString()} chars
      </div>
      <div className="text-xxs font-medium bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
        {props.voice_name}
      </div>
    </div>
  )
}
