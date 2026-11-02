import { api } from '@/lib/api'
import { md5 } from './md5'

const SYSTEM_SCOPE = 'system'

export type Scopes = Record<string, string>
export type AuthUser = { email: string; scopes: Scopes; isAdmin: boolean }
export type BootProbe = { firstLogin: boolean; authenticated: boolean }

type SuccessPayload = { success: boolean; message?: string }

// Backend encodes permissions into a flat `message` string for historical reasons.
// Two formats are observed in the wild:
//   "scope/role"               single scope, e.g. "system/ADMIN" or "LiveApp/USER"
//   '{"scope":"role", ...}'    JSON map for users with access to multiple apps
function parseScopes(message: string | undefined): Scopes {
  if (!message) return {}
  if (message.startsWith('{')) {
    try { return JSON.parse(message) as Scopes } catch { return {} }
  }
  const [rawScope, role = ''] = message.split('/')
  const scope = !rawScope || rawScope === 'null' ? SYSTEM_SCOPE : rawScope
  return { [scope]: role }
}

export function toAuthUser(email: string, message: string | undefined): AuthUser {
  const scopes = parseScopes(message)
  // No scopes at all is an older user, which the server treats as system.
  return { email, scopes, isAdmin: SYSTEM_SCOPE in scopes || Object.keys(scopes).length === 0 }
}

export async function login(email: string, password: string): Promise<AuthUser | null> {
  const res = await api.post<SuccessPayload>('/users/authenticate', { email, password: md5(password) })
  return res.success ? toAuthUser(email, res.message) : null
}

export async function registerFirstAdmin(email: string, password: string): Promise<boolean> {
  const res = await api.post<SuccessPayload>('/users/initial', { email, password: md5(password) })
  return res.success
}

export async function logout(): Promise<void> {
  // Treat any failure as already-logged-out; the client always clears its own state.
  await api.delete('/users/logout').catch(() => {})
}

export async function probeBoot(): Promise<BootProbe> {
  const [first, auth] = await Promise.all([
    api.get<SuccessPayload>('/first-login-status'),
    api.get<SuccessPayload>('/authentication-status'),
  ])
  return { firstLogin: first.success, authenticated: auth.success }
}

// Is the session cookie still valid. Throws when the backend is unreachable.
// Never emits: the auth-failure listener calls this, so a 403 here must not re-trigger it.
export async function checkAuthenticated(): Promise<boolean> {
  const res = await api.get<SuccessPayload>('/authentication-status', { suppressAuthEmit: true })
  return res.success
}
