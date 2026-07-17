import { appApi } from '../client'
import type { Result } from '../types'

// Per-stream subscribers (TOTP / time-based access), under `/v2/broadcasts`.
export function subscribers(app: string) {
  const c = appApi(app)
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (streamId: string, offset: number, size: number, signal?: AbortSignal) =>
      c.get<unknown[]>(`/broadcasts/${id(streamId)}/subscribers/list/${offset}/${size}`, { signal }),
    add: (streamId: string, subscriber: unknown) =>
      c.post<Result>(`/broadcasts/${id(streamId)}/subscribers`, subscriber),
    totp: (streamId: string, subscriberId: string, signal?: AbortSignal) =>
      c.get<unknown>(`/broadcasts/${id(streamId)}/subscribers/${id(subscriberId)}/totp`, { signal }),
    block: (streamId: string, subscriberId: string, seconds: number, type: string) =>
      c.put<Result>(`/broadcasts/${id(streamId)}/subscribers/${id(subscriberId)}/block/${seconds}/${type}`),
    remove: (streamId: string, subscriberId: string) =>
      c.delete<Result>(`/broadcasts/${id(streamId)}/subscribers/${id(subscriberId)}`),
    removeAll: (streamId: string) =>
      c.delete<Result>(`/broadcasts/${id(streamId)}/subscribers`),
  }
}
