import React from 'react'
import { Download, Trash2 } from 'react-feather'
import { twMerge } from 'tailwind-merge'
import { Button } from '../../../components/Button.js'
import { useSession } from '../../../hooks/useSession.js'
import { LogEntry, LogLevel } from '../../helpers/log-helpers.js'

const levelBadgeStyles: Record<LogLevel, string> = {
  INFO: 'bg-neutral-200/80 text-neutral-700',
  API: 'bg-blue-100 text-blue-800',
  WARN: 'bg-amber-100 text-amber-800',
  ERROR: 'bg-red-100 text-red-800',
}

/**
 * Verbose extension & API diagnostic log viewer with one-click text export
 * and log clearing.
 */
export function Logs() {
  const { session, ready } = useSession()
  const logs: LogEntry[] = Array.isArray(session?.logs) ? session.logs : []

  if (!ready) {
    return (
      <div className="text-xs text-neutral-500 py-6 text-center">
        Loading logs…
      </div>
    )
  }

  function handleExportLogs() {
    if (!logs.length) return

    const formatted = logs
      .map((entry) => {
        const header = `[${entry.timestamp}] [${entry.level}] ${entry.message}`
        return entry.details ? `${header}\n${entry.details}` : header
      })
      .join('\n\n')

    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wavenet-extension-log-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleClearLogs() {
    await chrome.runtime.sendMessage({ id: 'clearLogs' })
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between ml-0.5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800 tracking-tight">
            Extension & API Log
          </h2>
          <p className="text-xxs text-neutral-500">
            Verbose runtime events and redacted API request/response activity
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            className="w-fit py-1.5 px-2.5"
            Icon={Download}
            disabled={!logs.length}
            onClick={handleExportLogs}
          >
            Export log
          </Button>
          <Button
            className="w-fit py-1.5 px-2.5"
            Icon={Trash2}
            disabled={!logs.length}
            onClick={handleClearLogs}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col grow overflow-y-auto font-mono text-xxs divide-y divide-neutral-100">
        {logs.length === 0 ? (
          <div className="m-auto p-6 text-center font-sans text-xs text-neutral-500">
            No log entries recorded yet. Trigger a voice preview, read aloud, or
            API action to inspect activity here.
          </div>
        ) : (
          [...logs].reverse().map((entry) => {
            const timePart =
              entry.timestamp.split('T')[1]?.replace('Z', '') || entry.timestamp
            return (
              <div
                key={entry.id}
                className="px-3 py-2 flex flex-col gap-1 hover:bg-neutral-50/80"
              >
                <div className="flex items-start gap-2">
                  <span className="text-neutral-400 tabular-nums shrink-0">
                    {timePart}
                  </span>
                  <span
                    className={twMerge(
                      'px-1.5 py-0.2 rounded font-semibold shrink-0 text-[10px] leading-4',
                      levelBadgeStyles[entry.level] || levelBadgeStyles.INFO,
                    )}
                  >
                    {entry.level}
                  </span>
                  <span className="text-neutral-800 break-all leading-snug">
                    {entry.message}
                  </span>
                </div>
                {entry.details && (
                  <pre className="mt-0.5 p-2 rounded bg-neutral-50 border border-neutral-200/70 text-neutral-600 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                    {entry.details}
                  </pre>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
