import React, { useEffect, useState } from 'react'

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() =>
    getLocalStorageValue(key, defaultValue),
  )

  useEffect(
    () => localStorage.setItem(key, JSON.stringify(value)),
    [key, value],
  )

  return [value, setValue]
}

export function getLocalStorageValue(key, defaultValue) {
  const saved = localStorage.getItem(key)
  let initial
  try {
    initial = JSON.parse(saved)
  } catch {
    // A stale or hand-edited value should not break the whole popup.
  }

  return initial || defaultValue
}
