import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthFailure } from '@/lib/api'
import { storage } from '@/lib/localStorage'
import {
  login as apiLogin,
  logout as apiLogout,
  probeBoot,
  registerFirstAdmin as apiRegister,
  type AuthUser,
} from '@/lib/auth/api'

export type AuthStatus = 'probing' | 'first-login' | 'unauthenticated' | 'authenticated'

type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  scopes: string[]
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  registerFirstAdmin: (email: string, password: string) => Promise<boolean>
}

const STORAGE_KEY = 'ams.auth.user'

// The backend has no "GET /me" endpoint; it only reports whether the session cookie
// is still valid. We persist the parsed user (email + scopes) so a page refresh
// doesn't downgrade the UI to a generic view.
function loadStoredUser(): AuthUser | null {
  const parsed = storage.readJson<Partial<AuthUser> | null>(STORAGE_KEY, null)
  return parsed?.email ? (parsed as AuthUser) : null
}

function persistUser(user: AuthUser | null) {
  if (user) storage.writeJson(STORAGE_KEY, user)
  else storage.remove(STORAGE_KEY)
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('probing')
  const [user, setUser] = useState<AuthUser | null>(null)

  const apply = useCallback((next: AuthUser | null, nextStatus: AuthStatus) => {
    persistUser(next)
    setUser(next)
    setStatus(nextStatus)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const probe = await probeBoot()
        if (cancelled) return
        if (probe.firstLogin)         apply(null, 'first-login')
        else if (probe.authenticated) apply(loadStoredUser(), 'authenticated')
        else                          apply(null, 'unauthenticated')
      } catch {
        // Backend unreachable: fall through to /login so the failing transport surfaces there.
        if (!cancelled) apply(null, 'unauthenticated')
      }
    })()
    return () => { cancelled = true }
  }, [apply])

  // Layout guards own the redirect; they have the correct `useLocation()` to capture
  // the page the user was on, so login can return them there afterwards.
  useEffect(() => onAuthFailure(() => apply(null, 'unauthenticated')), [apply])

  const login = useCallback(async (email: string, password: string) => {
    const next = await apiLogin(email, password)
    if (!next) return false
    apply(next, 'authenticated')
    return true
  }, [apply])

  const logout = useCallback(async () => {
    await apiLogout()
    apply(null, 'unauthenticated')
  }, [apply])

  const registerFirstAdmin = useCallback(async (email: string, password: string) => {
    const ok = await apiRegister(email, password)
    if (ok) apply(null, 'unauthenticated')
    return ok
  }, [apply])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    isAuthenticated: status === 'authenticated',
    isAdmin: !!user?.isAdmin,
    scopes: user ? Object.keys(user.scopes) : [],
    login,
    logout,
    registerFirstAdmin,
  }), [status, user, login, logout, registerFirstAdmin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
