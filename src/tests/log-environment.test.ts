import { describe, expect, test } from 'bun:test'
import {
  environmentBanner,
  environmentHeader,
} from '../extension/helpers/log-helpers.js'

describe('exported log environment banner', () => {
  test(
    'a modern browser reports its full build and the raw user agent',
    () => {
      const banner = environmentBanner({
        version: '13.15.0',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Chrome) Chrome/143.0.0.24',
        userAgentData: {
          brands: [{ name: 'Chrome', version: '143' }],
          fullVersionList: [
            { name: 'Chromium', version: '143.0.0' },
            { name: 'Chrome', version: '143.0.0.24' },
            { name: 'Other', version: '0.0.0.0' },
          ],
          os: { name: 'Windows', version: 'NT' },
        },
      })

      expect(banner).toContain('Extension version: 13.15.0')
      expect(banner).toContain('Browser: Chrome 143.0.0.24')
      expect(banner).toContain('Platform: Windows NT')
      expect(banner).toContain('User agent: Mozilla/5.0')
    },
  )

  test(
    'only the named brand wins over the generic Chromium entry',
    () => {
      const banner = environmentBanner({
        version: '13.15.0',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Chrome) Edg/131.0.3067.98',
        userAgentData: {
          brands: [
            { name: 'Microsoft Edge', version: '131' },
            { name: 'Chromium', version: '131' },
          ],
          os: { name: 'Windows', version: '10.0' },
        },
      })

      expect(banner).toContain('Browser: Microsoft Edge 131')
      expect(banner).toContain('Platform: Windows 10.0')
    },
  )

  test(
    'an older browser without user agent data falls back to the UA string',
    () => {
      const banner = environmentBanner({
        version: '13.15.0',
        userAgent:
          'Mozilla/5.0 (X11) AppleWebKit/537.36 (KHTML, like Chrome) ' +
          'Chrome/109.0.1',
      })

      expect(banner).toContain('Browser: Chrome 109.0.1')
      expect(banner).toContain('Platform: Linux')
    },
  )

  test('a Windows UA still names the NT version it reports', () => {
    const banner = environmentBanner({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    })

    expect(banner).toContain('Platform: Windows NT 10.0')
    expect(banner).toContain('Browser: unknown')
    expect(banner).toContain('Extension version: unknown')
  })

  test(
    'a browser that hides everything still exports a readable banner',
    () => {
      const banner = environmentBanner({})

      expect(banner).not.toContain('User agent:')
      expect(banner.split('\n')).toHaveLength(3)
      expect(banner).toContain('Extension version: unknown')
    },
  )

  test(
    'the runtime header never throws when there is no navigator at all',
    () => {
      const header = environmentHeader()

      expect(header).toContain('Extension version:')
      expect(header).toContain('Browser: unknown')
      expect(header).toContain('Platform: unknown')
    },
  )
})
