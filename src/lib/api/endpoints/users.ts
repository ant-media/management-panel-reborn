import { api } from '../client'
import type { Result } from '../types'
import type { User } from '@/features/server-settings/use-users'

const id = (v: string) => encodeURIComponent(v)

// User management (console scope). The login/register/logout flow lives in lib/auth/api.ts.
export const users = {
  list: (signal?: AbortSignal) => api.get<User[]>('/user-list', { signal }),
  create: (user: User) => api.post<Result>('/users', user),
  update: (user: User) => api.put<Result>('/users', user),
  remove: (email: string) => api.delete<Result>(`/users/${id(email)}`),
  changePassword: (body: { email: string; password: string; newPassword: string }) =>
    api.post<Result>('/users/password', body),
  authenticationStatus: (signal?: AbortSignal) => api.get<Result>('/authentication-status', { signal }),
  firstLoginStatus: (signal?: AbortSignal) => api.get<Result>('/first-login-status', { signal }),
  adminStatus: (signal?: AbortSignal) => api.get<Result>('/admin-status', { signal }),
}
