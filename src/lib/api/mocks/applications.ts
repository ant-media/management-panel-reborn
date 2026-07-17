import { registerMock } from '@/lib/api'
import { APP_NAME_RE } from '@/features/apps/use-applications'
import type { AppSettings } from '@/features/apps/use-app-settings'
import { liveCountOf } from './broadcasts'

const GB = 1024 ** 3
const MB = 1024 ** 2

type MockApp = { name: string; vodCount: number; storage: number }

const apps: MockApp[] = [
  { name: 'LiveApp',     vodCount: 8, storage: 12 * GB },
  { name: 'WebRTCAppEE', vodCount: 0, storage: 240 * MB },
]

// liveStreamCount comes from the broadcast store, so it always agrees with the streams table
// and moves when a stream is started or stopped.
registerMock('GET', '/rest/v2/applications-info', () =>
  apps.map(a => ({ ...a, liveStreamCount: liveCountOf(a.name) })))

// /applications/{name}/metrics-history: REAL backend now (StatsCollector in-memory ring,
// viewers + streams). Mock kept for offline dev (matches the real shape). Health is NOT served
// (no backend metric yet); the row renders a TODO placeholder for it. Deterministic per app +
// cached so re-expanding is stable; scaled off the app's current live-stream count.
type AppMetricsHistory = { viewers: number[]; streams: number[] }
const histCache: Record<string, AppMetricsHistory> = {}

function appMetricsHistory(name: string): AppMetricsHistory {
  if (histCache[name]) return histCache[name]
  let r = [...name].reduce((s, c) => s + c.charCodeAt(0), 7)
  const rand = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff }
  const walk = (center: number, amp: number, whole = false) => {
    let v = center
    return Array.from({ length: 48 }, () => {
      v = Math.max(0, v + (rand() - 0.5) * amp)
      return whole ? Math.round(v) : Math.round(v * 10) / 10
    })
  }
  const live = Math.max(1, liveCountOf(name))
  histCache[name] = {
    viewers: walk(Math.max(20, live * 90), Math.max(20, live * 30), true),
    streams: walk(Math.max(1, live), Math.max(1, live * 0.4), true),
  }
  return histCache[name]
}

registerMock('GET', '/rest/v2/applications/:name/metrics-history', ({ params }) => appMetricsHistory(params.name))

// Create: POST = default app (JSON), PUT = custom app (multipart WAR). Both land here.
function createAppMock(name: string) {
  if (!APP_NAME_RE.test(name)) return { success: false, message: 'Application name is not alphanumeric.' }
  if (apps.some(a => a.name === name)) return { success: false, message: 'Application with the same name already exists' }
  apps.push({ name, vodCount: 0, storage: 0 })
  return { success: true }
}
registerMock('POST', '/rest/v2/applications/:name', ({ params }) => createAppMock(params.name))
registerMock('PUT', '/rest/v2/applications/:name', ({ params }) => createAppMock(params.name))

registerMock('DELETE', '/rest/v2/applications/:name', ({ params }) => {
  const idx = apps.findIndex(a => a.name === params.name)
  if (idx < 0) return { success: false, message: 'Application not found' }
  apps.splice(idx, 1)
  return { success: true }
})

// Per-app overrides on the seed; each exercises a path: generatePreview (thumbnails),
// writeStatsToDatastore off (the "stats disabled" viewer-graph state).
const SETTINGS_OVERRIDES: Record<string, Partial<AppSettings>> = {
  LiveApp: { generatePreview: true },
  WebRTCAppEE: { writeStatsToDatastore: false },
}

// A realistic AppSettings slice keyed by REAL field names. The last block is
// deliberately NOT in the editor's schema; it proves a save POSTs the WHOLE
// object back so untouched fields survive (the real POJO has ~200 of these).
function seedSettings(name: string): AppSettings {
  return {
    appName: name,
    h264Enabled: true, vp8Enabled: false, h265Enabled: false, av1Enabled: false,
    webRTCFrameRate: 30,
    encoderSettings: [
      { height: 720, videoBitrate: 1500, audioBitrate: 128, forceEncode: true },
      { height: 360, videoBitrate: 500, audioBitrate: 96, forceEncode: true },
    ],
    hlsMuxingEnabled: true, hlsListSize: '15', hlsTime: '2', deleteHLSFilesOnEnded: true,
    dashMuxingEnabled: false, lLDashEnabled: true, lLHLSEnabled: false, deleteDASHFilesOnEnded: true,
    generatePreview: false, objectDetectionEnabled: false, vodFolder: '', listenerHookURL: '',
    dataChannelEnabled: true, dataChannelPlayerDistribution: 'all',
    mp4MuxingEnabled: false, webMMuxingEnabled: false, addDateTimeToMp4FileName: false,
    s3RecordingEnabled: false, s3AccessKey: '', s3SecretKey: '', s3BucketName: '', s3RegionName: '', s3Endpoint: '', s3Permission: 'public-read',
    publishTokenControlEnabled: false, playTokenControlEnabled: false,
    enableTimeTokenForPublish: false, timeTokenSecretForPublish: '',
    enableTimeTokenForPlay: false, timeTokenSecretForPlay: '',
    publishJwtControlEnabled: false, playJwtControlEnabled: false, jwtStreamSecretKey: '',
    acceptOnlyStreamsInDataStore: false, writeStatsToDatastore: true,
    ipFilterEnabled: true, remoteAllowedCIDR: '127.0.0.1', jwtControlEnabled: false, jwtSecretKey: '',
    firebaseAccountKeyJSON: '', apnTeamId: '', apnKeyId: '', apnPrivateKey: '', apnsServer: '',
    // Not surfaced by the editor, must round-trip untouched on save.
    maxIdleTime: 5, encodingTimeout: 5000, webRTCPortRangeMin: 50000, webRTCPortRangeMax: 60000,
    ...SETTINGS_OVERRIDES[name],
  }
}

const settingsStore: Record<string, AppSettings> = {}
const getStored = (name: string): AppSettings => (settingsStore[name] ??= seedSettings(name))

registerMock('GET', '/rest/v2/applications/settings/:name', ({ params }) => ({ ...getStored(params.name) }))

registerMock('POST', '/rest/v2/applications/settings/:name', ({ params, body }) => {
  if (!body || typeof body !== 'object') return { success: false, message: 'Empty settings payload' }
  const next = body as AppSettings
  // A realistic server-side rejection so the reject path is exercisable in mocks:
  // enabling S3 recording with no bucket. The store is NOT touched, mirroring a real
  // failed save; the frontend keeps the draft so the user can fix and retry.
  if (next.s3RecordingEnabled === true && !next.s3BucketName) {
    return { success: false, message: 'S3 recording is enabled but no bucket name is set.' }
  }
  settingsStore[params.name] = { ...getStored(params.name), ...next }
  return { success: true }
})
