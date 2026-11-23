import { afterAll, describe, expect, test } from 'bun:test'

import { loggedFetch } from '../extension/helpers/log-helpers.js'

const originalFetch = globalThis.fetch
const originalChrome = (globalThis as any).chrome

afterAll(() => {
  globalThis.fetch = originalFetch
  ;(globalThis as any).chrome = originalChrome
})

describe('loggedFetch', () => {
  test('logs request metadata without the text or the API key', async () => {
    let logs: any[] = []
    ;(globalThis as any).chrome = {
      storage: {
        session: {
          get: async () => ({ logs }),
          set: async ({
            logs: next,
          }: {
            logs: any[]
          }) => {
            logs = next
          },
        },
      },
    }

    globalThis.fetch = (async () =>
      new Response('{}', { status: 200 })) as typeof fetch

    await loggedFetch('https://example.test/text:synthesize', {
      method: 'POST',
      headers: { 'X-Goog-Api-Key': 'SECRET_KEY_VALUE' },
      body: JSON.stringify({
        input: { text: 'MY PRIVATE SENTENCE' },
        voice: { languageCode: 'en-US' },
      }),
    })

    const stored = JSON.stringify(logs)
    expect(stored.includes('MY PRIVATE SENTENCE')).toBe(false)
    expect(stored.includes('[text omitted]')).toBe(true)
    expect(stored.includes('SECRET_KEY_VALUE')).toBe(false)
  })

  test('never logs an unparseable raw request body', async () => {
    let logs: any[] = []
    ;(globalThis as any).chrome = {
      storage: {
        session: {
          get: async () => ({ logs }),
          set: async ({ logs: next }: { logs: any[] }) => {
            logs = next
          },
        },
      },
    }
    globalThis.fetch = (async () =>
      new Response('{}', { status: 200 })) as typeof fetch

    await loggedFetch('https://example.test/text:synthesize', {
      method: 'POST',
      body: 'MY RAW PRIVATE SENTENCE',
    })

    expect(JSON.stringify(logs).includes('MY RAW PRIVATE SENTENCE')).toBe(false)
  })
})
