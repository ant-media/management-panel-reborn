import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { storage } from '@/lib/localStorage'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'regular'

export const ACCENTS = {
  red:    { label: 'AMS',    value: 'oklch(0.62 0.22 22)'  },
  blue:   { label: 'Blue',   value: 'oklch(0.55 0.20 245)' },
  green:  { label: 'Green',  value: 'oklch(0.58 0.16 150)' },
  purple: { label: 'Purple', value: 'oklch(0.55 0.20 305)' },
  amber:  { label: 'Amber',  value: 'oklch(0.72 0.17 70)'  },
} as const

export type AccentKey = keyof typeof ACCENTS

type ThemeState = {
  theme: ThemeMode
  accent: AccentKey
  density: Density
}

type ThemeContextValue = ThemeState & {
  setTheme: (t: ThemeMode) => void
  setAccent: (a: AccentKey) => void
  setDensity: (d: Density) => void
  effectiveDark: boolean
}

const STORAGE_KEY = 'ams.theme'
const DEFAULTS: ThemeState = { theme: 'system', accent: 'red', density: 'regular' }

function loadInitial(): ThemeState {
  const parsed = storage.readJson<Partial<ThemeState>>(STORAGE_KEY, {})
  return {
    theme:   parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
    accent:  parsed.accent && parsed.accent in ACCENTS ? parsed.accent : DEFAULTS.accent,
    density: parsed.density === 'compact' ? 'compact' : 'regular',
  }
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(loadInitial)
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const effectiveDark = state.theme === 'dark' || (state.theme === 'system' && systemDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', effectiveDark)
  }, [effectiveDark])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', ACCENTS[state.accent].value)
  }, [state.accent])

  useEffect(() => {
    document.documentElement.dataset.density = state.density
  }, [state.density])

  useEffect(() => {
    storage.writeJson(STORAGE_KEY, state)
  }, [state])

  const value: ThemeContextValue = {
    ...state,
    effectiveDark,
    setTheme:   theme   => setState(s => ({ ...s, theme   })),
    setAccent:  accent  => setState(s => ({ ...s, accent  })),
    setDensity: density => setState(s => ({ ...s, density })),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
