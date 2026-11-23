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
 * Best-effort browser name and version parsed out of a legacy user agent string,
 * for browsers that do not expose `navigator.userAgentData`.
 */
function browserFromUserAgent(userAgent: string): string {
  const edge = /Edg(?:e|A)?\/([\d.]+)/.exec(userAgent)
  const chrome = /Chrome\/([\d.]+)/.exec(userAgent)
  const version = (edge || chrome)?.[1]

  if (edge) return version ? `Microsoft Edge ${version}` : 'Microsoft Edge'
  if (chrome) return version ? `Chrome ${version}` : 'Chrome'
  return ''
}

/**
 * Best-effort operating system and version parsed out of a legacy user agent
 * string, mirroring what `navigator.userAgentData.os` would have reported.
 */
function osFromUserAgent(userAgent: string): string {
  const windows = /Windows NT ([\d.]+)/.exec(userAgent)
  if (windows) return `Windows NT ${windows[1]}`

  const mac = /Mac OS X ([\d_.]+)/.exec(userAgent)
  if (mac) return `Mac OS X ${mac[1]}`
  if (/Macintosh/.test(userAgent)) return 'Mac OS'
  if (/X11/.test(userAgent)) return 'Linux'
  return ''
}

/**
 * Formats the environment facts that head an exported diagnostic log: extension
 * build, browser build, operating system, and the raw user agent string.
 */
export function environmentBanner(
  environment: { userAgent?: string; userAgentData?: any; version?: string },
): string {
  const agentData = environment.userAgentData ?? {}
  const allBrands = agentData.fullVersionList?.length
    ? agentData.fullVersionList
    : agentData.brands ?? []
  const branded = allBrands.filter(
    (brand: any) => brand.name !== 'Chromium' && brand.name !== 'Other',
  )
  const brand = (branded.length ? branded : allBrands)[0]

  const browser =
    (brand?.name
      ? `${brand.name} ${brand.version || 'unknown'}`
      : browserFromUserAgent(environment.userAgent ?? '')) ||
    'unknown'
  const platform =
    (agentData.os?.name
      ? `${agentData.os.name} ${agentData.os.version || ''}`.trim()
      : osFromUserAgent(environment.userAgent ?? '')) ||
    'unknown'

  const lines = [
    `Extension version: ${environment.version || 'unknown'}`,
    `Browser: ${browser}`,
    `Platform: ${platform}`,
  ]

  if (environment.userAgent) {
    lines.push(`User agent: ${environment.userAgent}`)
  }

  return lines.join('\n')
}

/**
 * Reads whatever the current browser exposes about itself and formats it as the
 * banner for the export. Anything the browser hides reports as `unknown`.
 */
export function environmentHeader(): string {
  const agent = typeof navigator === 'undefined' ? undefined : navigator

  return environmentBanner({
    userAgent: agent?.userAgent,
    userAgentData: agent?.userAgentData,
    version: process.env.npm_package_version,
  })
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
        // `input` holds the text (or SSML) being synthesized. Log its shape,
        // never its contents — the diagnostic log is exportable and shared.
        const { input, ...rest } = parsed
        requestBodyPreview = {
          ...rest,
          ...(input !== undefined && { input: '[text omitted]' }),
        }
      }
    } catch {
      requestBodyPreview = '[unparseable request body]'
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
