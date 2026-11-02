import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, onAuthFailure } from '@/lib/api'
import { storage } from '@/lib/localStorage'
import {
  checkAuthenticated,
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
        if (probe.firstLogin) { apply(null, 'first-login'); return }
        if (!probe.authenticated) { apply(null, 'unauthenticated'); return }

        const stored = loadStoredUser()
        if (stored) { apply(stored, 'authenticated'); return }

        // Identity does not ride the session (docs/RISKS.md): a live session with no stored user
        // is one we did not create, e.g. the legacy console's on the shared cookie, and nothing
        // on the wire says whose it is. End it rather than render the panel as nobody.
        await apiLogout()
        if (!cancelled) apply(null, 'unauthenticated')
      } catch {
        // Backend unreachable: fall through to /login so the failing transport surfaces there.
        if (!cancelled) apply(null, 'unauthenticated')
      }
    })()
    return () => { cancelled = true }
  }, [apply])

  // Layout guards own the redirect; they have the correct `useLocation()` to capture
  // the page the user was on, so login can return them there afterwards.
  // A 403 can just mean this user may not do that, so only a dead session ends the login. An
  // unreachable backend throws and is left to the connection banner. The ref collapses the burst
  // of 403s a page's polls can produce into one check.
  const checkingSession = useRef(false)
  useEffect(() => onAuthFailure(() => {
    if (checkingSession.current) return
    checkingSession.current = true
    void checkAuthenticated()
      .then(alive => { if (!alive) apply(null, 'unauthenticated') })
      .catch(err => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) apply(null, 'unauthenticated')
      })
      .finally(() => { checkingSession.current = false })
  }), [apply])

  const login = useCallback(async (email: string, password: string) => {
    const next = await apiLogin(email, password)
    if (!next) return false
    apply(next, 'authenticated')
    return true
  }, [apply])

  // Stays in this panel: its own login page is the door back, and the switch there leads
  // to the legacy console. Same transition the 401 handler above makes.
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
