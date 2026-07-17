import { ApiError, registerMock } from '@/lib/api'
import type { Broadcast, BroadcastType, PublishType } from '@/features/streams/types'

// Per-app broadcasts store, keyed by app name. Each app starts seeded with a
// handful of realistic streams so the table demos cover empty/active/idle cases.
// Mutations are scoped per app; deleting in LiveApp leaves WebRTCAppEE alone.

type AppName = string
const stores = new Map<AppName, Broadcast[]>()

function nowMinus(days: number) {
  return Date.now() - days * 86_400_000
}

function seed(app: AppName): Broadcast[] {
  if (app === 'LiveApp') {
    return [
      {
        // Long name + id, to test the 14-char table clamp (display truncates with
        // an ellipsis; the full value stays in the copy button + hover title).
        streamId: 'conference-room-b-main-stage-camera-4k-uhd',
        name: 'Conference Room B - Main Stage Camera (4K UHD)',
        type: 'liveStream', status: 'broadcasting', publishType: 'RTMP',
        date: nowMinus(4), startTime: Date.now() - 2_400_000, duration: 2_400_000,
        hlsViewerCount: 312, webRTCViewerCount: 57,
        bitrate: 6_500_000, width: 3840, height: 2160,
        speed: 1.0, encoderQueueSize: 3, pendingPacketSize: 1, packetLostRatio: 0.002,
        endPointList: [
          { endpointUrl: 'rtmp://a.rtmp.youtube.com/live2/xxxx-xxxx', endpointServiceId: 'custom-yt01', type: 'generic', status: 'broadcasting' },
          { endpointUrl: 'srt://backup.cdn.example.com:9000', endpointServiceId: 'custom-srt02', type: 'generic', status: 'failed' },
        ],
      },
      {
        // Healthy: speed ~realtime, queues/loss all under threshold.
        streamId: 'lobby-cam', name: 'Lobby Camera', type: 'ipCamera',
        status: 'broadcasting', publishType: 'RTSP',
        date: nowMinus(12), startTime: Date.now() - 3_600_000, duration: 3_600_000,
        webRTCViewerCount: 23, hlsViewerCount: 41, dashViewerCount: 2,
        bitrate: 2_400_000, width: 1920, height: 1080,
        speed: 1.0, encoderQueueSize: 2, pendingPacketSize: 1, packetLostRatio: 0.001, rttMs: 18, jitterMs: 6,
        ipAddr: '192.168.1.42',
      },
      {
        // Unhealthy: ingest under network stress (loss/rtt/jitter) plus backed-up
        // queues and encoding falling behind realtime (speed < 0.7).
        streamId: 'concert-main', name: 'Live Concert', type: 'liveStream',
        status: 'broadcasting', publishType: 'WebRTC',
        date: nowMinus(2), startTime: Date.now() - 800_000, duration: 800_000,
        webRTCViewerCount: 412, hlsViewerCount: 1820,
        bitrate: 4_800_000, width: 1920, height: 1080,
        speed: 0.62, packetLostRatio: 0.045, rttMs: 140, jitterMs: 62, encoderQueueSize: 20, pendingPacketSize: 18,
      },
      {
        // Preparing: server is connecting to the source, not yet on-air.
        streamId: 'studio-feed', name: 'Studio Feed', type: 'ipCamera',
        status: 'preparing', publishType: 'RTSP',
        date: nowMinus(8), ipAddr: '192.168.1.77',
      },
      {
        // Error: backend auto-flipped a stuck stream after losing its input.
        streamId: 'night-archive', name: 'Night Archive', type: 'streamSource',
        status: 'terminated_unexpectedly', publishType: 'Pull',
        date: nowMinus(3),
        streamUrl: 'rtsp://feed.example.com:554/archive',
      },
      {
        // Idle publisher: nothing to start server-side, nothing to play.
        streamId: 'practice-room', name: 'Practice Room', type: 'liveStream',
        status: 'finished', publishType: 'RTMP',
        date: nowMinus(45),
      },
      {
        // Live playlist: server-startable, so it stops like a pulled source.
        streamId: 'morning-loop', name: 'Morning Loop', type: 'playlist',
        status: 'broadcasting', publishType: 'Pull',
        date: nowMinus(20), startTime: Date.now() - 5_400_000, duration: 5_400_000,
        hlsViewerCount: 64,
        bitrate: 3_100_000, width: 1920, height: 1080,
        speed: 1.0, encoderQueueSize: 1, packetLostRatio: 0,
        playlistLoopEnabled: true,
        playListItemList: [
          { streamUrl: 'https://cdn.example.com/vod/ident.mp4', type: 'VoD', name: 'Channel ident', durationInMs: 12_000 },
          { streamUrl: 'https://cdn.example.com/vod/highlights.mp4', type: 'VoD', name: 'Highlights', durationInMs: 445_000 },
        ],
      },
      {
        // Idle playlist.
        streamId: 'lobby-loop', name: 'Lobby Loop', type: 'playlist',
        status: 'created',
        date: nowMinus(6),
        playlistLoopEnabled: true,
        playListItemList: [
          { streamUrl: 'https://cdn.example.com/vod/welcome.mp4', type: 'VoD', name: 'Welcome', durationInMs: 62_000 },
          { streamUrl: 'https://cdn.example.com/vod/product-tour.mp4', type: 'VoD', name: 'Product tour', durationInMs: 184_000 },
        ],
      },
      {
        // Idle camera: the plain Start case.
        streamId: 'parking-cam', name: 'Parking Deck', type: 'ipCamera',
        status: 'created', publishType: 'RTSP',
        date: nowMinus(30),
        ipAddr: '192.168.1.91', username: 'viewer',
      },
    ]
  }
  if (app === 'WebRTCAppEE') {
    return [
      {
        streamId: 'meeting-001', name: 'All-hands', type: 'liveStream',
        status: 'broadcasting', publishType: 'WebRTC',
        date: nowMinus(1), startTime: Date.now() - 1_200_000, duration: 1_200_000,
        webRTCViewerCount: 88,
        bitrate: 1_200_000, width: 1280, height: 720,
        speed: 0.99, packetLostRatio: 0.004, rttMs: 28, jitterMs: 9, encoderQueueSize: 1,
      },
      {
        // Publisher still negotiating: force-stoppable, but nothing to play yet.
        streamId: 'town-hall', name: 'Town Hall', type: 'liveStream',
        status: 'preparing', publishType: 'WebRTC',
        date: nowMinus(1),
      },
      {
        streamId: 'relay-down', name: 'Relay Source', type: 'streamSource',
        status: 'failed', publishType: 'Pull',
        date: nowMinus(2),
        streamUrl: 'srt://relay.example.com:9100?streamid=down',
      },
      {
        streamId: 'demo-srt', name: 'SRT Demo', type: 'streamSource',
        status: 'created', publishType: 'SRT',
        date: nowMinus(5),
        streamUrl: 'srt://ingest.example.com:9000?streamid=demo',
      },
      {
        // A VoD record in the broadcast list: neither startable nor editable.
        streamId: 'keynote-2024', name: 'Keynote 2024 (recording)', type: 'VoD',
        status: 'finished',
        date: nowMinus(60), duration: 3_720_000,
      },
    ]
  }
  return []
}

// The sidebar/apps/dashboard live badge reads this. Derived, never a hand-kept number, so
// starting or stopping a stream in mock mode moves the badge like it would on a real server.
export const liveCountOf = (app: AppName) => storeOf(app).filter(b => b.status === 'broadcasting').length

function storeOf(app: AppName): Broadcast[] {
  let s = stores.get(app)
  if (!s) { s = seed(app); stores.set(app, s) }
  return s
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

// ±frac wobble so the detail drawer's live charts move in mock mode.
function jitter(base: number, frac: number): number {
  return Math.max(0, Math.round(base * (1 + (Math.random() * 2 - 1) * frac)))
}

const PROTO_BY_TYPE: Record<BroadcastType, PublishType | undefined> = {
  liveStream: 'WebRTC',
  ipCamera: 'RTSP',
  streamSource: 'Pull',
  playlist: 'Pull',
  VoD: undefined,
}

// ── LIST ────────────────────────────────────────────────────────────
registerMock('GET', '/:app/rest/v2/broadcasts/list/:offset/:size', ({ params, query }) => {
  const all = [...storeOf(params.app)]
  const search = String(query.search ?? '').toLowerCase()
  const type = query.type_by as BroadcastType | undefined
  const sort = query.sort_by as 'name' | 'date' | 'status' | undefined
  const order = (query.order_by as 'asc' | 'desc' | undefined) ?? 'asc'

  let filtered = all
  if (type) filtered = filtered.filter(b => b.type === type)
  if (search) filtered = filtered.filter(b =>
    (b.name ?? '').toLowerCase().includes(search) || b.streamId.toLowerCase().includes(search))

  if (sort) {
    const cmp = (a: Broadcast, b: Broadcast): number => {
      if (sort === 'name')   return (a.name ?? '').localeCompare(b.name ?? '')
      if (sort === 'status') return a.status.localeCompare(b.status)
      return (a.date ?? 0) - (b.date ?? 0)
    }
    filtered.sort(cmp)
    if (order === 'desc') filtered.reverse()
  }

  const offset = Number(params.offset) || 0
  const size = Math.min(Number(params.size) || 50, 50)
  return filtered.slice(offset, offset + size)
})

// ── COUNTS ──────────────────────────────────────────────────────────
registerMock('GET', '/:app/rest/v2/broadcasts/count',           ({ params }) => ({ number: storeOf(params.app).length }))
registerMock('GET', '/:app/rest/v2/broadcasts/count/:search',   ({ params }) => {
  const q = params.search.toLowerCase()
  return { number: storeOf(params.app).filter(b => (b.name ?? '').toLowerCase().includes(q) || b.streamId.toLowerCase().includes(q)).length }
})
registerMock('GET', '/:app/rest/v2/broadcasts/active-live-stream-count', ({ params }) => ({
  number: storeOf(params.app).filter(b => b.status === 'broadcasting').length,
}))

// ── GET ONE ─────────────────────────────────────────────────────────
registerMock('GET', '/:app/rest/v2/broadcasts/:id', ({ params }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  if (!b) return { success: false, message: 'Not found' }
  if (b.status !== 'broadcasting') return b
  // Jitter a copy so the chart moves; don't mutate the store.
  return { ...b, bitrate: jitter(b.bitrate ?? 0, 0.08) }
})

// ── DETAIL: statistics (Phase 9) ────────────────────────────────────
registerMock('GET', '/:app/rest/v2/broadcasts/:id/broadcast-statistics', ({ params }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  const live = b?.status === 'broadcasting'
  const w = (n: number | undefined) => (live ? jitter(n ?? 0, 0.05) : 0)
  return {
    totalWebRTCWatchersCount: w(b?.webRTCViewerCount),
    totalHLSWatchersCount:    w(b?.hlsViewerCount),
    totalDASHWatchersCount:   w(b?.dashViewerCount),
  }
})

// ── DETAIL: per-player WebRTC stats (Phase 9) ───────────────────────
registerMock('GET', '/:app/rest/v2/broadcasts/:id/webrtc-client-stats/:offset/:size', ({ params }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  if (!b || b.status !== 'broadcasting') return []
  const count = Math.min(b.webRTCViewerCount ?? 0, Number(params.size) || 50)
  const target = b.bitrate ?? 2_000_000
  return Array.from({ length: count }, (_, i) => ({
    measuredBitrate: jitter(target, 0.12),
    sendBitrate: jitter(target, 0.1),
    videoFrameSendPeriod: jitter(33, 0.15),
    audioFrameSendPeriod: jitter(21, 0.1),
    clientId: 1000 + i,
    clientIp: `10.0.${i % 4}.${20 + i}`,
  }))
})

// ── DETAIL: per-stream metric history (Phase 16) ────────────────────
registerMock('GET', '/:app/rest/v2/broadcasts/:id/metrics-history', ({ params }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  const empty = { bitrate: [], viewers: [], speed: [], encoderQueueSize: [], droppedPackets: [], droppedFrames: [], packetLostRatio: [] }
  if (!b || b.status !== 'broadcasting') return empty
  const bitrate = b.bitrate ?? 2_000_000
  const viewers = (b.webRTCViewerCount ?? 0) + (b.hlsViewerCount ?? 0) + (b.dashViewerCount ?? 0)
  const series = <T,>(f: () => T) => Array.from({ length: 60 }, f) // ~10 min at the server's 10s cadence
  return {
    bitrate: series(() => Math.round(jitter(bitrate, 0.1))),
    viewers: series(() => Math.max(0, Math.round(jitter(viewers, 0.15)))),
    speed: series(() => +jitter(1, 0.03).toFixed(3)),
    encoderQueueSize: series(() => Math.max(0, Math.round(jitter(2, 0.5)))),
    droppedPackets: series(() => 0),
    droppedFrames: series(() => 0),
    packetLostRatio: series(() => +jitter(0.004, 0.6).toFixed(4)),
  }
})

// ── DETAIL: recording control (Phase 9) ─────────────────────────────
registerMock('PUT', '/:app/rest/v2/broadcasts/:id/recording/:status', ({ params }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  if (!b) return { success: false, message: 'Not found' }
  b.mp4Enabled = params.status === 'true' ? 1 : 0
  return { success: true }
})

// ── DETAIL: re-streaming endpoints (RTMP/SRT push) ──────────────────
registerMock('POST', '/:app/rest/v2/broadcasts/:id/endpoint', ({ params, body }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  if (!b) return { success: false, message: 'Not found' }
  const { endpointUrl } = (body ?? {}) as { endpointUrl?: string }
  if (!endpointUrl) return { success: false, message: 'Missing endpoint URL' }
  const endpointServiceId = generateId('custom')
  b.endPointList = [
    ...(b.endPointList ?? []),
    // Forward immediately if the stream is already live, else queue until it starts.
    { endpointUrl, endpointServiceId, type: 'generic', status: b.status === 'broadcasting' ? 'broadcasting' : 'created' },
  ]
  return { success: true, dataId: endpointServiceId }
})

registerMock('DELETE', '/:app/rest/v2/broadcasts/:id/endpoint', ({ params, query }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  if (!b) return { success: false, message: 'Not found' }
  b.endPointList = (b.endPointList ?? []).filter(e => e.endpointServiceId !== query.endpointServiceId)
  return { success: true }
})

// ── CREATE ──────────────────────────────────────────────────────────
// autoStart only applies to ipCamera/streamSource; when set, the source starts
// pulling immediately (status broadcasting); otherwise everything lands "created".
registerMock('POST', '/:app/rest/v2/broadcasts/create', ({ params, body, query }) => {
  const input = (body ?? {}) as Partial<Broadcast>
  const streamId = input.streamId?.trim() || generateId('stream')
  const store = storeOf(params.app)
  if (store.some(b => b.streamId === streamId)) {
    return { success: false, message: `Stream ID "${streamId}" already exists.` }
  }
  const type = (input.type ?? 'liveStream') as BroadcastType
  const pulled = type === 'ipCamera' || type === 'streamSource'
  const autoStart = pulled && String(query.autoStart) === 'true'
  // IP camera: backend connects via ONVIF and derives an authed RTSP URL.
  const streamUrl = type === 'ipCamera' && input.ipAddr
    ? `rtsp://${input.username ?? ''}:***@${input.ipAddr}/profile1`
    : input.streamUrl
  const created: Broadcast = {
    streamId,
    name: input.name ?? streamId,
    description: input.description,
    type,
    status: autoStart ? 'broadcasting' : 'created',
    date: Date.now(),
    startTime: autoStart ? Date.now() : undefined,
    publishType: PROTO_BY_TYPE[type],
    streamUrl,
    ipAddr: input.ipAddr,
    username: input.username,
    playListItemList: input.playListItemList,
    playlistLoopEnabled: input.playlistLoopEnabled,
    mp4Enabled: input.mp4Enabled,
  }
  store.push(created)
  return created
})

// A stream definition (from an import) lands as a plain "created" broadcast.
function definitionToBroadcast(input: Partial<Broadcast>, streamId: string): Broadcast {
  const type = (input.type ?? 'liveStream') as BroadcastType
  return {
    streamId,
    name: input.name ?? streamId,
    description: input.description,
    type,
    status: 'created',
    date: Date.now(),
    publishType: PROTO_BY_TYPE[type],
    streamUrl: input.streamUrl,
    ipAddr: input.ipAddr,
    username: input.username,
    playListItemList: input.playListItemList,
    playlistLoopEnabled: input.playlistLoopEnabled,
    mp4Enabled: input.mp4Enabled,
  }
}

// Mirror the real transport's 400: message and body both carry the Result JSON,
// so the import modal can parse the conflict message out of ApiError.body.
function badRequest(message: string): ApiError {
  const payload = JSON.stringify({ success: false, message })
  return new ApiError(400, payload, payload)
}

// ── CREATE LIST (bulk import) ───────────────────────────────────────
// onDuplicate absent → 400 if any id already exists (nothing created); 'skip'
// keeps existing streams, 'overwrite' replaces them. Returns one Result per
// stream: dataId = stream id, message = created|skipped|overridden|failed.
registerMock('POST', '/:app/rest/v2/broadcasts/create-list', ({ params, body, query }) => {
  const streams = Array.isArray(body) ? (body as Partial<Broadcast>[]) : []
  if (streams.length === 0) {
    return badRequest('No streams provided')
  }

  const store = storeOf(params.app)
  const onDuplicate = String(query.onDuplicate ?? '')
  const skip = onDuplicate === 'skip'
  const overwrite = onDuplicate === 'overwrite'

  if (!skip && !overwrite) {
    const dupes = streams
      .map(s => s.streamId?.trim())
      .filter((id): id is string => Boolean(id) && store.some(b => b.streamId === id))
    if (dupes.length > 0) {
      return badRequest(`Stream id(s) already in use: ${dupes.join(', ')}`)
    }
  }

  return streams.map(s => {
    const streamId = s.streamId?.trim() || ''
    const existingIdx = streamId ? store.findIndex(b => b.streamId === streamId) : -1
    if (existingIdx >= 0) {
      if (skip) return { success: true, dataId: streamId, message: 'skipped' }
      if (overwrite) {
        store.splice(existingIdx, 1)
        store.push(definitionToBroadcast(s, streamId))
        return { success: true, dataId: streamId, message: 'overridden' }
      }
      return { success: false, dataId: streamId, message: 'failed' }
    }
    const id = streamId || generateId('stream')
    store.push(definitionToBroadcast(s, id))
    return { success: true, dataId: id, message: 'created' }
  })
})

// ── ONVIF DISCOVERY ─────────────────────────────────────────────────
registerMock('GET', '/:app/rest/v2/broadcasts/onvif-devices', () => [
  'http://192.168.1.42:8080/onvif/device_service',
  'http://192.168.1.77:80/onvif/device_service',
])

// ── DELETE (single) ─────────────────────────────────────────────────
registerMock('DELETE', '/:app/rest/v2/broadcasts/:id', ({ params }) => {
  const store = storeOf(params.app)
  const idx = store.findIndex(b => b.streamId === params.id)
  if (idx < 0) return { success: false, message: 'Not found' }
  store.splice(idx, 1)
  return { success: true }
})

// ── DELETE (bulk) ───────────────────────────────────────────────────
registerMock('DELETE', '/:app/rest/v2/broadcasts/', ({ params, query }) => {
  const ids = String(query.ids ?? '').split(',').filter(Boolean)
  if (ids.length === 0) return { success: false, message: 'No ids provided' }
  const store = storeOf(params.app)
  const idSet = new Set(ids)
  const before = store.length
  for (let i = store.length - 1; i >= 0; i--) {
    if (idSet.has(store[i].streamId)) store.splice(i, 1)
  }
  return { success: true, message: `Deleted ${before - store.length}` }
})

// ── START / STOP ────────────────────────────────────────────────────
registerMock('POST', '/:app/rest/v2/broadcasts/:id/start', ({ params }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  if (!b) return { success: false, message: 'Not found' }
  b.status = 'broadcasting'
  b.startTime = Date.now()
  return { success: true }
})

registerMock('POST', '/:app/rest/v2/broadcasts/:id/stop', ({ params }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  if (!b) return { success: false, message: 'Not found' }
  b.status = 'finished'
  b.duration = b.startTime ? Date.now() - b.startTime : 0
  return { success: true }
})

// ── UPDATE (Phase 9 uses this; safe to register now) ────────────────
registerMock('PUT', '/:app/rest/v2/broadcasts/:id', ({ params, body }) => {
  const b = storeOf(params.app).find(x => x.streamId === params.id)
  if (!b) return { success: false, message: 'Not found' }
  Object.assign(b, body)
  return { success: true }
})

