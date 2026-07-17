import type { IconName } from '@/components/ui/icon'
import type { AppSettings } from './use-app-settings'

// ── The category/presentation overlay for AppSettings ────────────────────────
// The backend returns a FLAT AppSettings POJO (key → value); it has no notion of
// sections, labels, or which fields are "advanced". That grouping is a frontend
// concern today, so the data layer injects it from this const. When the backend
// grows a real settings-descriptor API, delete this file's const and have
// getSettingsSchema() read categories off the response; the component never moves.
//
// Keys are the REAL AppSettings field names (verified against AppSettings.java +
// the shipping Angular console), so an edit POSTs back onto the same field.

export type Rendition = { height: number; videoBitrate: number; audioBitrate: number; forceEncode?: boolean }

export type FieldType = 'bool' | 'num' | 'text' | 'textarea' | 'select' | 'radio' | 'renditions'

export type SettingField = {
  key: string
  label: string
  type: FieldType
  def: unknown
  hint?: string
  info?: string                       // sparse info-dot tooltip for non-obvious fields
  advanced?: boolean                  // metadata only for now, surfaced in Phase 11-a
  options?: [value: string, label: string][]   // select / radio
  reveal?: boolean                    // render indented under the toggle above it
  showWhen?: (v: AppSettings) => boolean
  generate?: number                   // text/textarea: show "Generate" → N random chars
  minLen?: number                     // soft: warn (don't block) below this length
  // Security safety net (see fieldStatus). `required` = must be non-empty while the field
  // is shown (its toggle is on), else the control denies all access. `strictLen` = a HARD
  // minimum the backend enforces (e.g. jwtStreamSecretKey <32 → every token rejected), so a
  // shorter value blocks the save. Both only matter while the field is revealed.
  required?: boolean
  strictLen?: number
  rules?: FieldRule[]                 // conditional checks the shorthands can't express
}

// Server facts the draft can't carry. `null` = unknown (probe in flight or failed) ⇒ stay quiet.
export type RuleContext = { enterprise: boolean | null }

// `when` sees the whole draft, so a rule may depend on any other field. First match wins; skipped
// while `showWhen` hides the field. Predicates are code; they never come from a backend
// descriptor (ARCHITECTURE.md *Presentation metadata*).
export type FieldRule = {
  when: (v: AppSettings, ctx: RuleContext) => boolean
  severity: 'error' | 'warning'   // error blocks Save; warning never does
  message: string
}

export type SettingSection = {
  id: string
  title: string
  icon: IconName
  desc?: string
  info?: string
  fields: SettingField[]
}

const RESOLUTIONS = [2880, 2160, 1080, 720, 640, 540, 480, 360, 240]
export const RENDITION_HEIGHTS = RESOLUTIONS

const S3_PERMISSIONS: [string, string][] = [
  ['public-read', 'public-read'],
  ['private', 'private'],
  ['public-read-write', 'public-read-write'],
  ['authenticated-read', 'authenticated-read'],
  ['bucket-owner-read', 'bucket-owner-read'],
  ['bucket-owner-full-control', 'bucket-owner-full-control'],
]

// Lenient bool reads (Jackson-shaped): "true"/"false" strings count. Absent/null
// is neither on nor off, so predicates stay quiet on unset keys.
export const isOn = (v: unknown): boolean => v === true || (typeof v === 'string' && v.trim().toLowerCase() === 'true')
export const isOff = (v: unknown): boolean => v === false || (typeof v === 'string' && v.trim().toLowerCase() === 'false')

const on = (key: string) => (v: AppSettings) => isOn(v[key])

// Reusable rule: `key` is read only by Ant-Media-Enterprise (trace the reader, don't trust docs).
const requiresEnterprise = (key: string): FieldRule => ({
  when: (v, ctx) => isOn(v[key]) && ctx.enterprise === false,
  severity: 'warning',
  message: 'Enterprise Edition only: Community ignores this setting.',
})

const SETTINGS_SCHEMA: SettingSection[] = [
  {
    id: 'webrtc-codec', title: 'WebRTC Codec Support', icon: 'video',
    desc: 'Which codecs the application accepts and emits.',
    fields: [
      { key: 'h264Enabled', label: 'H.264', type: 'bool', def: true, hint: 'Required for MP4 recording and HLS streaming.' },
      { key: 'vp8Enabled', label: 'VP8', type: 'bool', def: false, hint: 'WebM recording needs this or AV1.' },
      { key: 'h265Enabled', label: 'H.265 / HEVC', type: 'bool', def: false, advanced: true },
      { key: 'av1Enabled', label: 'AV1', type: 'bool', def: false, advanced: true },
    ],
  },
  {
    id: 'adaptive', title: 'Adaptive Streaming', icon: 'network',
    desc: 'Generate multiple renditions for adaptive bitrate playback.',
    info: 'Each rendition adds CPU and bandwidth cost on the origin. Keep the list short.',
    fields: [
      { key: 'webRTCFrameRate', label: 'Frame Rate (fps)', type: 'num', def: 30,
        info: 'Output frame rate after transcoding. Source FPS above this is down-sampled.' },
      { key: 'encoderSettings', label: 'Renditions', type: 'renditions', def: [],
        hint: 'Each rendition adds CPU and bandwidth cost on the origin.' },
    ],
  },
  {
    id: 'hls', title: 'HLS Streaming', icon: 'rss',
    desc: 'HTTP Live Streaming output (.m3u8).',
    info: 'HLS works almost everywhere but adds 6-30s of latency. For sub-second use WebRTC.',
    fields: [
      { key: 'hlsMuxingEnabled', label: 'Create HLS streaming', type: 'bool', def: true,
        rules: [
          // EncoderAdaptor gates the H.264 HLS muxer + startAdaptiveHLS() on isH264Enabled(); the
          // community passthrough muxer doesn't, so this warns rather than blocks.
          { when: v => isOn(v.hlsMuxingEnabled) && isOff(v.h264Enabled), severity: 'warning',
            message: 'Needs H.264: without it no HLS renditions or adaptive playlist are produced. Enable it under WebRTC Codec Support.' },
        ] },
      { key: 'hlsListSize', label: 'Segment list size', type: 'num', def: '15', reveal: true, showWhen: on('hlsMuxingEnabled'),
        info: 'Segments kept in the playlist. Larger = bigger rewind buffer but higher latency.' },
      { key: 'hlsTime', label: 'Segment duration (seconds)', type: 'num', def: '2', reveal: true, showWhen: on('hlsMuxingEnabled'),
        info: 'Target duration of each .ts segment. Most CDNs work best around 2-6s.' },
      { key: 'deleteHLSFilesOnEnded', label: 'Delete HLS files after the stream ends', type: 'bool', def: true, reveal: true, showWhen: on('hlsMuxingEnabled') },
    ],
  },
  {
    id: 'dash', title: 'DASH & CMAF Streaming', icon: 'database',
    desc: 'MPEG-DASH and low-latency CMAF segmented output.',
    fields: [
      { key: 'dashMuxingEnabled', label: 'Create DASH streaming', type: 'bool', def: false },
      { key: 'lLDashEnabled', label: 'Low-latency DASH (CMAF)', type: 'bool', def: true, reveal: true, showWhen: on('dashMuxingEnabled') },
      { key: 'lLHLSEnabled', label: 'Low-latency HLS (CMAF)', type: 'bool', def: false, reveal: true, showWhen: on('dashMuxingEnabled') },
      { key: 'deleteDASHFilesOnEnded', label: 'Delete DASH files after the stream ends', type: 'bool', def: true, reveal: true, showWhen: on('dashMuxingEnabled') },
    ],
  },
  {
    id: 'processing', title: 'Stream Processing', icon: 'cog',
    desc: 'Per-stream processing pipelines and integrations.',
    fields: [
      { key: 'generatePreview', label: 'Generate preview', type: 'bool', def: false, hint: 'Generate a periodic JPEG preview of every active stream.',
        rules: [
          requiresEnterprise('generatePreview'),   // sole reader is EncoderAdaptor
          // EncoderAdaptor only builds the PreviewMuxer on its non-empty-renditions branch. An
          // *absent* encoderSettings (vs. empty) means we can't tell: stay quiet (RISKS.md).
          { when: v => isOn(v.generatePreview) && Array.isArray(v.encoderSettings) && v.encoderSettings.length === 0, severity: 'warning',
            message: 'Needs at least one rendition: without transcoding no preview is produced. Add one under Adaptive Streaming › Renditions.' },
        ] },
      { key: 'objectDetectionEnabled', label: 'Use object detection', type: 'bool', def: false, advanced: true, hint: 'Adds significant CPU load on the origin.' },
      { key: 'vodFolder', label: 'VoD streaming folder', type: 'text', def: '' },
      { key: 'listenerHookURL', label: 'Webhook URL', type: 'text', def: '', info: 'Stream lifecycle events are POSTed to this URL.' },
    ],
  },
  {
    id: 'data-channel', title: 'WebRTC Data Channel', icon: 'terminal',
    desc: 'Chat-style messaging between publishers and players.',
    fields: [
      { key: 'dataChannelEnabled', label: 'Enable', type: 'bool', def: true, hint: 'Publishers can send messages to players.' },
      { key: 'dataChannelPlayerDistribution', label: "Players' messages are distributed to", type: 'radio', def: 'all',
        options: [['none', 'Nobody'], ['publisher', 'Only publisher'], ['all', 'Publisher & all players']],
        reveal: true, showWhen: on('dataChannelEnabled') },
    ],
  },
  {
    id: 'recording', title: 'Stream Recording', icon: 'record',
    desc: 'Persist live streams to disk (and optionally S3) as VoD assets.',
    fields: [
      { key: 'mp4MuxingEnabled', label: 'Record live streams as MP4', type: 'bool', def: false },
      { key: 'webMMuxingEnabled', label: 'Record live streams as WebM', type: 'bool', def: false,
        rules: [
          requiresEnterprise('webMMuxingEnabled'),   // every `new WebMMuxer` is in EncoderAdaptor
          // WebM carries VP8/AV1, never H.264; either encoder feeds the muxer, so both must be off.
          { when: v => isOn(v.webMMuxingEnabled) && isOff(v.vp8Enabled) && isOff(v.av1Enabled), severity: 'warning',
            message: 'Needs VP8 or AV1: WebM cannot carry H.264, so the recording gets no video track. Enable one under WebRTC Codec Support.' },
        ] },
      { key: 'addDateTimeToMp4FileName', label: 'Add date-time to recording filenames', type: 'bool', def: false },
      { key: 's3RecordingEnabled', label: 'Upload recordings to S3', type: 'bool', def: false },
      { key: 's3AccessKey', label: 'S3 access key', type: 'text', def: '', reveal: true, showWhen: on('s3RecordingEnabled') },
      { key: 's3SecretKey', label: 'S3 secret key', type: 'text', def: '', reveal: true, showWhen: on('s3RecordingEnabled') },
      { key: 's3BucketName', label: 'S3 bucket name', type: 'text', def: '', reveal: true, showWhen: on('s3RecordingEnabled') },
      { key: 's3RegionName', label: 'S3 region', type: 'text', def: '', reveal: true, showWhen: on('s3RecordingEnabled') },
      { key: 's3Endpoint', label: 'S3 endpoint', type: 'text', def: '', reveal: true, showWhen: on('s3RecordingEnabled'), hint: 'Leave blank for AWS.' },
      { key: 's3Permission', label: 'S3 object permission', type: 'select', def: 'public-read', options: S3_PERMISSIONS, reveal: true, showWhen: on('s3RecordingEnabled') },
    ],
  },
  {
    id: 'security', title: 'Stream Security', icon: 'shield',
    desc: 'Token-based publishing/playback, TOTP, JWT.',
    info: 'Tokens are validated at ingest and at playback. Tokens never appear in stream URLs.',
    fields: [
      { key: 'publishTokenControlEnabled', label: 'Publish with one-time tokens', type: 'bool', def: false },
      { key: 'playTokenControlEnabled', label: 'Play with one-time tokens', type: 'bool', def: false },
      { key: 'enableTimeTokenForPublish', label: 'Publish with TOTP', type: 'bool', def: false, advanced: true },
      { key: 'timeTokenSecretForPublish', label: 'Secret for TOTP publishing', type: 'textarea', def: '', generate: 16, minLen: 6, required: true, reveal: true, showWhen: on('enableTimeTokenForPublish') },
      { key: 'enableTimeTokenForPlay', label: 'Play with TOTP', type: 'bool', def: false, advanced: true },
      { key: 'timeTokenSecretForPlay', label: 'Secret for TOTP playing', type: 'textarea', def: '', generate: 16, minLen: 6, required: true, reveal: true, showWhen: on('enableTimeTokenForPlay') },
      { key: 'publishJwtControlEnabled', label: 'Publish with JWT tokens', type: 'bool', def: false, advanced: true },
      { key: 'playJwtControlEnabled', label: 'Play with JWT tokens', type: 'bool', def: false, advanced: true },
      { key: 'jwtStreamSecretKey', label: 'JWT stream secret key', type: 'textarea', def: '', generate: 32, required: true, strictLen: 32, reveal: true,
        showWhen: v => isOn(v.publishJwtControlEnabled) || isOn(v.playJwtControlEnabled) },
      { key: 'acceptOnlyStreamsInDataStore', label: 'Accept only registered streams', type: 'bool', def: false,
        hint: 'When off, the server ingests undefined / unregistered stream IDs.' },
    ],
  },
  {
    id: 'rest-api-security', title: 'REST API Security', icon: 'lock',
    desc: 'Restrict who can call the management REST API.',
    fields: [
      { key: 'ipFilterEnabled', label: 'IP filter for the REST API', type: 'bool', def: true,
        info: 'Drops REST API calls from any IP outside the allowed CIDR ranges.' },
      { key: 'remoteAllowedCIDR', label: 'Allowed CIDR ranges', type: 'textarea', def: '127.0.0.1', required: true, reveal: true, showWhen: on('ipFilterEnabled'),
        hint: 'Comma-separated. Only requests from these ranges can call the REST API.' },
      { key: 'jwtControlEnabled', label: 'JWT filter for the REST API', type: 'bool', def: false, advanced: true },
      { key: 'jwtSecretKey', label: 'Secret key for the JWT filter', type: 'textarea', def: '', generate: 32, minLen: 32, required: true, reveal: true, showWhen: on('jwtControlEnabled') },
    ],
  },
  {
    id: 'push', title: 'Push Notification', icon: 'bell',
    desc: 'Send push notifications when stream events fire.',
    fields: [
      { key: 'firebaseAccountKeyJSON', label: 'Firebase (FCM) service-account JSON', type: 'textarea', def: '', hint: 'Paste your Firebase service-account JSON.' },
      { key: 'apnTeamId', label: 'Apple Push · Team ID', type: 'text', def: '', advanced: true },
      { key: 'apnKeyId', label: 'Apple Push · Key ID', type: 'text', def: '', advanced: true },
      { key: 'apnPrivateKey', label: 'Apple Push · Private key', type: 'textarea', def: '', advanced: true },
      { key: 'apnsServer', label: 'Apple Push · APN server', type: 'text', def: '', advanced: true },
    ],
  },
]

// The swap seam. Today: ignore `data` and return the const above. Tomorrow: read
// `categories` off the live settings response and build sections from it; the
// call site already passes `data`, so this function's body is the ONLY thing that
// changes. (Param is accepted now precisely so the signature never has to.)
export function getSettingsSchema(_data?: AppSettings | null): SettingSection[] {
  return SETTINGS_SCHEMA
}

export const asString = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

// ── Value semantics ───────────────────────────────────────────────────────────
// parseFieldValue is the ONE interpreter of raw wire values. Controls, dirty
// marks, filters and import previews all read through it (or canonValue/isOn/
// isOff); never re-coerce locally. Lenient the way Jackson is, per field type:
//   bool        true/false, or "true"/"false" strings (any case, trimmed)
//   num         finite number, or a numeric string ("15": some POJO fields are
//               String on the wire; NumberStepper emits the raw value's type)
//   renditions  an array
//   text-like   string or number
// null/absent parse to `def`. Anything else is junk (`ok: false`): it displays
// the default, compares RAW (stays a visible change), gets a type-mismatch
// warning from fieldStatus, and ships to the server unchanged; the server is
// the type authority. Non-schema keys are never inspected or coerced.
// Accepted corner: junk on a showWhen-hidden field ships without a warning
// (fieldStatus skips hidden fields).

export type ParsedValue = { value: unknown; ok: boolean }

export function parseFieldValue(field: SettingField, raw: unknown): ParsedValue {
  const v = raw ?? field.def
  switch (field.type) {
    case 'bool': {
      if (isOn(v)) return { value: true, ok: true }
      if (isOff(v)) return { value: false, ok: true }
      return { value: isOn(field.def), ok: false }
    }
    case 'num': {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
      return Number.isFinite(n) ? { value: n, ok: true } : { value: Number(field.def), ok: false }
    }
    case 'renditions':
      return Array.isArray(v) ? { value: v, ok: true } : { value: [], ok: false }
    default:
      return typeof v === 'string' || typeof v === 'number'
        ? { value: asString(v), ok: true }
        : { value: asString(field.def), ok: false }
  }
}

// Equivalence key for dirty/non-default checks: interpreted value when readable, raw otherwise.
export function canonValue(field: SettingField, raw: unknown): unknown {
  const p = parseFieldValue(field, raw)
  return p.ok ? p.value : raw
}

const TYPE_HINT: Record<FieldType, string> = {
  bool: 'true or false', num: 'a number', renditions: 'a renditions list',
  text: 'text', textarea: 'text', select: 'text', radio: 'text',
}

const short = (v: unknown): string => {
  const s = JSON.stringify(v) ?? String(v)
  return s.length > 40 ? `${s.slice(0, 40)}…` : s
}

export type FieldStatus = { error?: string; warning?: string }

// One status per field, worst-first: type misfit → `required`/`strictLen` errors
// (a blank or short secret locks the app out) → `rules` → the soft `minLen`
// warning. Hidden fields have no status.
export function fieldStatus(field: SettingField, values: AppSettings, ctx: RuleContext): FieldStatus {
  if (field.showWhen && !field.showWhen(values)) return {}

  const raw = values[field.key]
  if (!parseFieldValue(field, raw).ok) {
    return { warning: `Value type mismatch: expected ${TYPE_HINT[field.type]}, got ${short(raw)}. Sent unchanged on save; the server may reject it.` }
  }

  const v = asString(raw)

  if (field.required && v.trim() === '') {
    return { error: 'Required: with the control above on, a blank value blocks all access.' }
  }
  if (field.strictLen != null && v.length > 0 && v.length < field.strictLen) {
    return { error: `Must be at least ${field.strictLen} characters: shorter keys are rejected, locking out access.` }
  }
  const hit = field.rules?.find(r => r.when(values, ctx))
  if (hit) return hit.severity === 'error' ? { error: hit.message } : { warning: hit.message }

  if (field.minLen != null && v.length > 0 && v.length < field.minLen) {
    return { warning: `Recommended at least ${field.minLen} characters.` }
  }
  return {}
}
