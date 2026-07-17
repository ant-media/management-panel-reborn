import { api } from '../client'
import type { Result } from '../types'

export const support = {
  request: (body: unknown) => api.post<Result>('/support/request', body),
}
