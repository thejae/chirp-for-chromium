import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { getLocalStorageValue } from '../hooks/useLocalStorage.js'

describe('getLocalStorageValue', () => {
  let saved = ''

  beforeEach(() => {
    saved = ''
    globalThis.localStorage = {
      getItem: mock((_key: string) => saved || null),
      setItem: mock((_key: string, _value: string) => {}),
    } as any
  })

  test('reads a stored value', () => {
    saved = '"hello"'

    expect(getLocalStorageValue('key', 'fallback')).toBe('hello')
  })

  test('uses the default when nothing is stored', () => {
    expect(getLocalStorageValue('key', 'fallback')).toBe('fallback')
  })

  test('uses the default when stored data is corrupt', () => {
    saved = '{not json'

    expect(getLocalStorageValue('key', 'fallback')).toBe('fallback')
  })
})
