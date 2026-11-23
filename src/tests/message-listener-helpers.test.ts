import { describe, expect, mock, test } from 'bun:test'

import {
  respondWithHandlerResult,
  resolveTargetTab,
} from '../extension/helpers/message-listener-helpers.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('respondWithHandlerResult', () => {
  test('replies with a resolved handler result', async () => {
    const sendResponse = mock((_response: any) => {})
    respondWithHandlerResult(
      { ping: async () => 'pong' },
      'ping',
      {},
      sendResponse,
    )

    await flush()

    expect(sendResponse.mock.calls).toEqual([['pong']])
  })

  test('replies with a structured error when the handler rejects', async () => {
    const sendResponse = mock((_response: any) => {})
    respondWithHandlerResult(
      {
        play: async () => {
          throw new Error('audio load failed')
        },
      },
      'play',
      {},
      sendResponse,
    )

    await flush()

    expect(sendResponse.mock.calls).toEqual([
      [
        {
          error: true,
          errorCode: 'MESSAGE_HANDLER_FAILED',
          errorTitle: 'Something went wrong',
          errorMessage: 'audio load failed',
        },
      ],
    ])
  })

  test('keeps a non-Error rejection as the message', async () => {
    const sendResponse = mock((_response: any) => {})
    respondWithHandlerResult(
      {
        play: async () => {
          throw 'offline'
        },
      },
      'play',
      {},
      sendResponse,
    )

    await flush()

    expect(sendResponse.mock.calls[0][0].errorMessage).toBe('offline')
  })
})

describe('resolveTargetTab', () => {
  test('uses the remembered session tab when one exists', async () => {
    const get = mock(async (id: number) => ({ id }))
    const query = mock(async (_query: any) => [{ id: 9, active: true }])

    const tab = await resolveTargetTab(42, { get, query })

    expect(tab).toEqual({ id: 42 })
    expect(get.mock.calls).toEqual([[42]])
    expect(query.mock.calls).toEqual([])
  })

  test('returns null when the session tab has closed', async () => {
    const get = mock(async (_id: number) => {
      throw new Error('No tab with id 42')
    })
    const query = mock(async (_query: any) => [{ id: 9, active: true }])

    const tab = await resolveTargetTab(42, { get, query })

    expect(tab).toBeNull()
    expect(query.mock.calls).toEqual([])
  })

  test('falls back to the active tab when no session is running', async () => {
    const get = mock(async (id: number) => ({ id }))
    const query = mock(async (_query: any) => [{ id: 9, active: true }])

    const tab = await resolveTargetTab(null, { get, query })

    expect(tab).toEqual({ id: 9, active: true })
    expect(query.mock.calls).toEqual([[{ active: true, currentWindow: true }]])
    expect(get.mock.calls).toEqual([])
  })
})
