import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

// localStorage access throws in Safari private mode, on hardened browsers, and on
// quota overflow. These helpers swallow it (reads fall back, writes no-op) since
// persisted UI state is never load-bearing. Go through this instead of touching
// window.localStorage directly (except the pre-bundle theme bootstrap in index.html).

function get(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function set(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  } catch {
    // unavailable or full
  }
}

function remove(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key)
  } catch {
    // unavailable
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = get(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  let raw: string
  try {
    raw = JSON.stringify(value)
  } catch {
    return // unserialisable
  }
  set(key, raw)
}

export const storage = { get, set, remove, readJson, writeJson }

// useState that persists to localStorage. Drop-in; storage failures degrade to in-memory.
export function useStoredState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => storage.readJson(key, initial))
  const set = useCallback<Dispatch<SetStateAction<T>>>(next => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      storage.writeJson(key, resolved)
      return resolved
    })
  }, [key])
  return [value, set]
}
