export type LogLevel = 'INFO' | 'API' | 'WARN' | 'ERROR'

export type LogEntry = {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  details?: string
}

const MAX_LOG_ENTRIES = 300
let logQueue: Promise<void> = Promise.resolve()

/**
 * Redacts sensitive API keys and bearer tokens from URLs, headers, and strings
 * before persisting or exporting verbose logs.
 */
function redactSecrets(input: string): string {
  return input
    .replace(/([?&]key=)[^&\s"]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[^\s"]+/gi, '$1[REDACTED]')
    .replace(/("secret_key"\s*:\s*")[^"]+"/gi, '$1[REDACTED]"')
    .replace(/("apiKey"\s*:\s*")[^"]+"/gi, '$1[REDACTED]"')
}

/**
 * Formats an optional detail payload into a readable, redacted string.
 */
function formatDetails(details: unknown): string | undefined {
  if (details === undefined || details === null) return undefined
  try {
    const raw =
      typeof details === 'string' ? details : JSON.stringify(details, null, 2)
    return redactSecrets(raw)
  } catch {
    return redactSecrets(String(details))
  }
}

/**
 * Appends a structured verbose log entry to `chrome.storage.session.logs`.
 * Uses a serialized promise queue so concurrent background events never
 * overwrite each other's log entries.
 */
export function appendLog(
  level: LogLevel,
  message: string,
  details?: unknown,
): Promise<void> {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    message: redactSecrets(message),
    details: formatDetails(details),
  }

  logQueue = logQueue
    .then(async () => {
      const session = await chrome.storage.session.get('logs')
      const existing: LogEntry[] = Array.isArray(session.logs)
        ? session.logs
        : []
      const updated = [...existing.slice(-(MAX_LOG_ENTRIES - 1)), entry]
      await chrome.storage.session.set({ logs: updated })
    })
    .catch((err) => {
      console.warn('Failed to write log entry:', err)
    })

  return logQueue
}

/**
 * Clears all stored verbose logs from `chrome.storage.session`.
 */
export async function clearLogs(): Promise<void> {
  logQueue = logQueue
    .then(async () => {
      await chrome.storage.session.set({ logs: [] })
    })
    .catch(() => {})
  return logQueue
}

/**
 * Performs an HTTP `fetch` while recording verbose request and response
 * diagnostics (method, URL, request body summary, status, duration, and error
 * payload) into the extension log.
 */
export async function loggedFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const method = options?.method || 'GET'
  const startTime = Date.now()
  let requestBodyPreview: unknown = undefined

  if (typeof options?.body === 'string') {
    try {
      const parsed = JSON.parse(options.body)
      if (parsed && typeof parsed === 'object') {
        requestBodyPreview = {
          ...parsed,
          ...(typeof parsed.text === 'string' && {
            text:
              parsed.text.length > 120
                ? `${parsed.text.slice(0, 120)}… (${parsed.text.length} chars)`
                : parsed.text,
          }),
        }
      }
    } catch {
      requestBodyPreview = options.body
    }
  }

  await appendLog(
    'API',
    `→ ${method} ${url}`,
    requestBodyPreview ? { request: requestBodyPreview } : undefined,
  )

  try {
    const response = await fetch(url, options)
    const elapsedMs = Date.now() - startTime
    const clone = response.clone()
    let responsePreview: unknown = undefined

    try {
      const json = await clone.json()
      if (json && typeof json === 'object' && 'audioContent' in json) {
        responsePreview = {
          ...json,
          audioContent: `[base64 audio, ${String(json.audioContent).length} chars]`,
        }
      } else if (Array.isArray(json)) {
        responsePreview = {
          count: json.length,
          sample: json.slice(0, 15),
        }
      } else {
        responsePreview = json
      }
    } catch {
      // Non-JSON response body
    }

    await appendLog(
      response.ok ? 'API' : 'ERROR',
      `← ${response.status} ${response.statusText || ''} ${method} ${url} (${elapsedMs}ms)`,
      responsePreview,
    )

    return response
  } catch (error: any) {
    const elapsedMs = Date.now() - startTime
    await appendLog(
      'ERROR',
      `✖ ${method} ${url} failed after ${elapsedMs}ms`,
      error?.message || String(error),
    )
    throw error
  }
}
