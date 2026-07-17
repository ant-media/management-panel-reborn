import { appApi } from '../client'
import { listQuery, type ListOpts, type Result } from '../types'
import type { Broadcast } from '@/features/streams/types'

// GET /broadcasts/{id}/broadcast-statistics
export type BroadcastStatistics = {
  totalHLSWatchersCount: number
  totalWebRTCWatchersCount: number
  totalDASHWatchersCount: number
}

// GET /broadcasts/{id}/webrtc-client-stats/{offset}/{size}: one row per player
export type WebRTCClientStat = {
  measuredBitrate: number
  sendBitrate: number
  videoFrameSendPeriod: number
  audioFrameSendPeriod: number
  clientId: number
  clientIp?: string
}

// GET /broadcasts/{id}/metrics-history: parallel oldest→newest series (in-memory ring, ~4h)
export type StreamMetricsHistory = {
  bitrate: number[]
  viewers: number[]
  speed: number[]
  encoderQueueSize: number[]
  droppedPackets: number[]
  droppedFrames: number[]
  packetLostRatio: number[]
}

// Per-app broadcasts surface (`@Path /v2/broadcasts`). Factory bound to one app;
// every method is one REST call + its stateless wire→model transform.
export function broadcasts(app: string) {
  const c = appApi(app)
  const id = (v: string) => encodeURIComponent(v)

  return {
    // ── Core CRUD ────────────────────────────────────────────────────────────
    list: (offset: number, size: number, opts: ListOpts = {}, signal?: AbortSignal) =>
      c.get<Broadcast[]>(`/broadcasts/list/${offset}/${size}`, { query: listQuery(opts), signal }),
    get: (streamId: string, signal?: AbortSignal) =>
      c.get<Broadcast>(`/broadcasts/${id(streamId)}`, { signal }),
    // autoStart only matters for ipCamera/streamSource: true = start pulling now.
    create: (input: Partial<Broadcast>, opts: { autoStart?: boolean } = {}) =>
      c.post<Broadcast>('/broadcasts/create', { type: 'liveStream', ...input }, { query: { autoStart: opts.autoStart } }),
    // Bulk create (import). onDuplicate omitted → the whole request 400s if any id
    // already exists; 'skip' keeps existing streams, 'overwrite' replaces them.
    // Returns one Result per stream: dataId = stream id, message = created|skipped|overridden|failed.
    createMany: (streams: Partial<Broadcast>[], opts: { onDuplicate?: 'skip' | 'overwrite' } = {}) =>
      c.post<Result[]>('/broadcasts/create-list', streams, { query: { onDuplicate: opts.onDuplicate } }),
    update: (streamId: string, patch: Partial<Broadcast>) =>
      c.put<Result>(`/broadcasts/${id(streamId)}`, patch),
    remove: (streamId: string) =>
      c.delete<Result>(`/broadcasts/${id(streamId)}`),
    // Bulk delete: comma-separated ids as a query param on the collection path.
    removeMany: (ids: string[]) =>
      c.delete<Result>('/broadcasts/', { query: { ids: ids.join(',') } }),

    // ── Counts (unwrap {number} → number) ────────────────────────────────────
    count: (search?: string, signal?: AbortSignal) => {
      const s = search?.trim()
      const path = s ? `/broadcasts/count/${id(s)}` : '/broadcasts/count'
      return c.get<{ number: number }>(path, { signal }).then(r => r.number)
    },
    activeLiveStreamCount: (signal?: AbortSignal) =>
      c.get<{ number: number }>('/broadcasts/active-live-stream-count', { signal }).then(r => r.number),

    // ── Lifecycle ────────────────────────────────────────────────────────────
    start: (streamId: string) => c.post<Result>(`/broadcasts/${id(streamId)}/start`),
    stop: (streamId: string) => c.post<Result>(`/broadcasts/${id(streamId)}/stop`),
    // Recording override; recordType selects the muxer (backend defaults to mp4).
    record: (streamId: string, enabled: boolean, recordType: 'mp4' | 'webm' = 'mp4') =>
      c.put<Result>(`/broadcasts/${id(streamId)}/recording/${enabled}`, undefined, { query: { recordType } }),

    // ── Monitoring ───────────────────────────────────────────────────────────
    statistics: (streamId: string, signal?: AbortSignal) =>
      c.get<BroadcastStatistics>(`/broadcasts/${id(streamId)}/broadcast-statistics`, { signal }),
    totalStatistics: (signal?: AbortSignal) =>
      c.get<BroadcastStatistics>('/broadcasts/total-broadcast-statistics', { signal }),
    webrtcClientStats: (streamId: string, offset: number, size: number, signal?: AbortSignal) =>
      c.get<WebRTCClientStat[]>(`/broadcasts/${id(streamId)}/webrtc-client-stats/${offset}/${size}`, { signal }),
    metricsHistory: (streamId: string, signal?: AbortSignal) =>
      c.get<StreamMetricsHistory>(`/broadcasts/${id(streamId)}/metrics-history`, { signal }),
    streamInfo: (streamId: string, signal?: AbortSignal) =>
      c.get<unknown[]>(`/broadcasts/${id(streamId)}/stream-info`, { signal }),
    // Per-stream connection log; the building block for Phase 15's event log.
    connectionEvents: (streamId: string, offset: number, size: number, signal?: AbortSignal) =>
      c.get<unknown[]>(`/broadcasts/${id(streamId)}/connection-events/${offset}/${size}`, { signal }),

    // ── Access tokens (no clean backend DTO, loose shapes) ───────────────────
    getToken: (streamId: string, expireDate: number, type: 'play' | 'publish', roomId?: string) =>
      c.get<unknown>(`/broadcasts/${id(streamId)}/token`, { query: { expireDate, type, roomId } }),
    getJwtToken: (streamId: string, expireDate: number, type: 'play' | 'publish', roomId?: string) =>
      c.get<unknown>(`/broadcasts/${id(streamId)}/jwt-token`, { query: { expireDate, type, roomId } }),
    validateToken: (token: unknown) =>
      c.post<Result>('/broadcasts/validate-token', token),
    listTokens: (streamId: string, offset: number, size: number, signal?: AbortSignal) =>
      c.get<unknown[]>(`/broadcasts/${id(streamId)}/tokens/list/${offset}/${size}`, { signal }),
    revokeTokens: (streamId: string) =>
      c.delete<Result>(`/broadcasts/${id(streamId)}/tokens`),
  }
}
