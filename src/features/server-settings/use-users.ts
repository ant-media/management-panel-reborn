import { useApi } from '@/lib/api/use-api'
import { users as usersApi } from '@/lib/api/endpoints'
import { errorMessage, type Result } from '@/lib/api'
import { md5 } from '@/lib/auth/md5'

export type UserRole = 'ADMIN' | 'USER' | 'READ_ONLY'

export type User = {
  email: string
  userType?: string
  scope?: string
  appNameUserType?: Record<string, string>
  firstName?: string
  lastName?: string
  fullName?: string
  picture?: string
  id?: string
  password?: string      // write-only on the backend; only ever sent
  newPassword?: string   // write-only
}

export const SYSTEM_SCOPE = 'system'

export const ROLE_OPTIONS: [UserRole, string][] = [
  ['ADMIN', 'Admin'], ['USER', 'User'], ['READ_ONLY', 'Read-only'],
]

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', USER: 'User', READ_ONLY: 'Read-only' }
export const roleLabel = (role: string) => ROLE_LABEL[role] ?? role

// A user's effective role: prefer the legacy userType, fall back to the newer
// appNameUserType map (system entry, else its first value).
export function roleOf(u: User): string {
  if (u.userType) return String(u.userType)
  const map = u.appNameUserType ?? {}
  return map[SYSTEM_SCOPE] ?? Object.values(map)[0] ?? ''
}

export function displayName(u: User): string {
  return u.fullName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email
}

export function useUsers() {
  return useApi<User[]>(signal => usersApi.list(signal))
}

// We use the system-scoped model (Phase 12 decision) and send BOTH the legacy
// scope+userType AND the appNameUserType map, so whichever path the backend reads
// persists the same role. (Per-app scoping is deferred; docs/dev-progress/TODO.md V2.)
function systemUser(email: string, role: UserRole, extra: Partial<User> = {}): User {
  return { email, userType: role, scope: SYSTEM_SCOPE, appNameUserType: { [SYSTEM_SCOPE]: role }, ...extra }
}

async function run(label: string, fn: () => Promise<Result>): Promise<Result> {
  try {
    const res = await fn()
    if (!res || res.success === false) console.warn(`[Users] ${label} rejected by server:`, res)
    return res ?? { success: false, message: 'Empty response' }
  } catch (err) {
    return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
  }
}

export function addUser(input: { email: string; password: string; firstName: string; lastName: string; role: UserRole }): Promise<Result> {
  return run('create', () => usersApi.create(systemUser(input.email, input.role, {
    password: md5(input.password), firstName: input.firstName, lastName: input.lastName,
  })))
}

export function editUser(email: string, role: UserRole, newPassword?: string): Promise<Result> {
  const body = systemUser(email, role)
  if (newPassword) body.newPassword = md5(newPassword)
  return run('update', () => usersApi.update(body))
}

export function removeUser(email: string): Promise<Result> {
  return run('remove', () => usersApi.remove(email))
}

// Change the CURRENT user's own password: the backend verifies the old one.
export function changeMyPassword(email: string, oldPassword: string, newPassword: string): Promise<Result> {
  return run('changePassword', () => usersApi.changePassword({ email, password: md5(oldPassword), newPassword: md5(newPassword) }))
}
