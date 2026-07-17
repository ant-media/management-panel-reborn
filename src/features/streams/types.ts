// Subset of the Java Broadcast model, only fields the UI actually reads.
// Add more as new tabs need them; don't preemptively model the whole entity.

export type BroadcastStatus =
  | 'broadcasting'
  | 'preparing'
  | 'created'
  | 'finished'
  | 'error'
  | 'failed'
  // Backend auto-flips a stuck broadcasting/preparing stream here after ~20s
  // with no stats update (Broadcast.getStatus). Treated as an error state.
  | 'terminated_unexpectedly'

export type BroadcastType =
  | 'liveStream'
  | 'ipCamera'
  | 'streamSource'
  | 'VoD'
  | 'playlist'

// Wire-side publish protocol, set by the server when ingest starts.
// Used to drive the protocol badge in the list.
export type PublishType = 'WebRTC' | 'RTMP' | 'Pull' | 'SRT' | 'HLS' | 'RTSP'

export type Broadcast = {
  streamId: string
  name?: string
  description?: string
  status: BroadcastStatus
  type: BroadcastType
  publishType?: PublishType
  date: number
  startTime?: number
  duration?: number
  updateTime?: number

  // Playback viewer counts. AMS has no RTMP playback, so RTMP is not tracked.
  hlsViewerCount?: number
  dashViewerCount?: number
  webRTCViewerCount?: number

  // Per-protocol viewer caps. -1 = unlimited, the backend's default.
  hlsViewerLimit?: number
  dashViewerLimit?: number
  webRTCViewerLimit?: number

  // Ingest source (IP camera / stream source / playlist).
  ipAddr?: string
  username?: string
  password?: string
  streamUrl?: string
  playListItemList?: PlayListItem[]
  playlistLoopEnabled?: boolean
  // Playlist auto-start, in unix *seconds*. 0 = unscheduled.
  plannedStartDate?: number
  // Server-pulled sources (ipCamera/streamSource): start/stop with viewer presence.
  autoStartStopEnabled?: boolean

  // Quality (only meaningful when broadcasting). `bitrate` is received bits/sec.
  bitrate?: number
  width?: number
  height?: number
  speed?: number

  // Ingest health (only meaningful when broadcasting).
  encoderQueueSize?: number
  pendingPacketSize?: number
  dropPacketCountInIngestion?: number
  dropFrameCountInEncoding?: number
  packetLostRatio?: number
  jitterMs?: number
  rttMs?: number

  // Stream-level recording overrides: 1 = on, 0 = app default, -1 = off.
  mp4Enabled?: number
  webMEnabled?: number

  origin?: string
  originAdress?: string

  // Re-streaming (RTMP/SRT push) targets: the server republishes the live
  // stream to each. Present on the full broadcast record, rides /broadcasts/{id}.
  endPointList?: Endpoint[]

  publicStream?: boolean
  listenerHookURL?: string
}

// One re-streaming target attached to a broadcast: the server forwards the live
// stream to `endpointUrl`. `type` is "generic" for custom RTMP/SRT URLs (social
// targets, youtube/facebook, are enterprise/OAuth and out of scope here).
// `endpointServiceId` is server-assigned and the key used to remove it.
export type Endpoint = {
  endpointUrl: string
  endpointServiceId: string
  type: string
  status?: BroadcastStatus
}

// One entry of a playlist broadcast. The backend computes durationInMs; we send
// the URL (+ optional name) and let it resolve the rest. `type` is "VoD" for files.
export type PlayListItem = {
  streamUrl: string
  type: string
  name?: string
  seekTimeInMs?: number
  durationInMs?: number
}

// Generic REST envelope lives in the api layer; re-exported for stream callers.
export type { Result } from '@/lib/api'

const LIVE_STATUSES: ReadonlySet<BroadcastStatus> = new Set(['broadcasting', 'preparing'])

export const isLive = (s: BroadcastStatus | undefined) => Boolean(s && LIVE_STATUSES.has(s))

// A count can momentarily read negative under decrement races, so clamp each before summing.
export const totalViewers = (b: Broadcast): number =>
  Math.max(0, b.webRTCViewerCount ?? 0) + Math.max(0, b.hlsViewerCount ?? 0) + Math.max(0, b.dashViewerCount ?? 0)

// Server-initiated streams: the server owns the ingest, so it can be started and stopped.
// Push streams (WebRTC/RTMP publishers) end when the publisher disconnects; see streamAction.
export const isStartable = (b: Broadcast) =>
  b.type === 'ipCamera' || b.type === 'streamSource' || b.type === 'playlist'

// A VoD record carries no editable definition; every other type does.
export const isEditable = (b: Broadcast) => b.type !== 'VoD'

// Effective recording state: the per-stream override (1 = on, -1 = off, 0/absent =
// app default) layered over the app's muxer setting. Shared by the row menu + drawer.
export const recordingOn = (override: number | undefined, appDefault: unknown): boolean =>
  override === 1 || (override !== -1 && Boolean(appDefault))

export const displayName = (b: Broadcast) => b.name?.trim() || b.streamId
