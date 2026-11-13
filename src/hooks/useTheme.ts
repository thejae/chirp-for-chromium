import { useEffect, useState } from 'react'

/** User-selectable theme preference stored in `chrome.storage.sync`. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** Concrete resolved theme applied to the DOM. */
export type ResolvedTheme = 'light' | 'dark'

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

/**
 * Returns the current OS/browser color scheme preference (`'dark'` or `'light'`).
 */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
}

/**
 * Resolves a stored theme preference (`'system' | 'light' | 'dark'`) against
 * the current OS/browser color scheme and listens for live system theme changes.
 *
 * @param preference - The user's saved theme preference (defaults to `'system'`).
 * @returns The normalized preference, resolved `'light' | 'dark'` theme,
 *   `isDark` convenience boolean, and live `systemTheme`.
 */
export function useTheme(preference?: ThemePreference) {
  const normalizedPreference: ThemePreference =
    preference === 'light' || preference === 'dark' || preference === 'system'
      ? preference
      : 'system'

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    // Sync immediately in case the system theme changed before mount
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  const resolvedTheme: ResolvedTheme =
    normalizedPreference === 'system' ? systemTheme : normalizedPreference

  return {
    themePreference: normalizedPreference,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    systemTheme,
  }
}
