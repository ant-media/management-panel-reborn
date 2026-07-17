import type { Broadcast, BroadcastType, PlayListItem } from '../types'

// The stream editor's draft model: Broadcast wire <-> form state, plus the patch that saves it.
// Pure, so both modals share it and it stays checkable outside React.
//
// PUT /broadcasts/{id} merges the non-null fields of a BroadcastUpdate, so edit sends only what
// changed. Not just tidiness: on Mongo a PUT that changes nothing answers success:false
// (getModifiedCount() == 1), so a no-op patch would read as a failure.

// The wire's "no cap" sentinel. The form shows it as an empty field and never surfaces it.
export const UNLIMITED = -1

export type LimitKey = 'webRTCViewerLimit' | 'hlsViewerLimit' | 'dashViewerLimit'
export const VIEWER_LIMITS: [key: LimitKey, label: string][] = [
  ['webRTCViewerLimit', 'WebRTC'],
  ['hlsViewerLimit', 'HLS'],
  ['dashViewerLimit', 'DASH'],
]
// The field is a Java int. Seven digits is far past any real cap and keeps us inside it.
export const LIMIT_MAX_DIGITS = 7

// The backend's own scheme whitelist (RestServiceBase.checkStreamUrl), plus a non-empty
// remainder: it splits the URL on "//" and indexes [1], so a bare "rtsp://" throws there.
export const STREAM_URL_RE = /^(https?|rtmps?|rtsps?|udp|srt):\/\/.+/i
export const STREAM_URL_HINT = 'Source URL must start with rtmp://, rtsp://, srt://, udp://, http:// or https://.'

export type Draft = Record<LimitKey, string> & {
  name: string
  description: string
  streamUrl: string
  ipAddr: string
  username: string
  password: string
  autoStartStopEnabled: boolean
  playlistLoopEnabled: boolean
  schedule: string // datetime-local, local wall-clock; '' = unscheduled
}

// One playlist row: the wire item, minus the server-computed durationInMs, plus a render key.
export type PlaylistDraftItem = {
  key: number // render identity only, never on the wire
  streamUrl: string
  name?: string // display name of a picked VoD; dropped when the URL is typed over
  // No UI yet (V2), but an edit replaces the whole list, so carry them through or an offset
  // set in the old console is silently zeroed.
  seekTimeInMs?: number
  type?: string
}

let nextKey = 1
export const newDraftItem = (partial?: Omit<Partial<PlaylistDraftItem>, 'key'>): PlaylistDraftItem =>
  ({ key: nextKey++, streamUrl: '', ...partial })

const limitToInput = (v: number | undefined) => (v === undefined || v === UNLIMITED ? '' : String(v))
const inputToLimit = (v: string) => (v === '' ? UNLIMITED : Number(v))

// plannedStartDate is unix *seconds*; 0 = unscheduled.
const toScheduleInput = (sec: number | undefined) => {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// An unparseable value reads as unscheduled rather than reaching the wire as NaN (-> null).
export const fromScheduleInput = (v: string) => Math.floor((Number(new Date(v)) || 0) / 1000)

export const toDraft = (b: Broadcast): Draft => ({
  name: b.name ?? '',
  description: b.description ?? '',
  webRTCViewerLimit: limitToInput(b.webRTCViewerLimit),
  hlsViewerLimit: limitToInput(b.hlsViewerLimit),
  dashViewerLimit: limitToInput(b.dashViewerLimit),
  streamUrl: b.streamUrl ?? '',
  ipAddr: b.ipAddr ?? '',
  username: b.username ?? '',
  password: b.password ?? '',
  autoStartStopEnabled: b.autoStartStopEnabled ?? false,
  playlistLoopEnabled: b.playlistLoopEnabled ?? false,
  schedule: toScheduleInput(b.plannedStartDate),
})

// A stored item with no URL is unplayable and the backend drops it anyway
// (removeEmptyPlayListItems), so it never becomes a row: then an empty row always means the
// user just added one, and the form can say so instead of silently disabling Save.
export const toDraftItems = (b: Broadcast): PlaylistDraftItem[] =>
  (b.playListItemList ?? [])
    .filter(it => it.streamUrl?.trim())
    .map(({ streamUrl, name, seekTimeInMs, type }) => newDraftItem({ streamUrl, name, seekTimeInMs, type }))

export const toPlayListItems = (items: PlaylistDraftItem[]): PlayListItem[] =>
  items
    .filter(it => it.streamUrl.trim())
    // durationInMs is server-computed (updatePlayListItemDurationsIfApplicable); never send it.
    .map(it => ({
      streamUrl: it.streamUrl.trim(),
      type: it.type ?? 'VoD',
      seekTimeInMs: it.seekTimeInMs ?? 0,
      ...(it.name ? { name: it.name } : null),
    }))

// The wire values the edit modal owns, for one type. Diffing two of these (seed vs current)
// is the patch, so both sides normalise identically and a retyped value or a stray trailing
// space is never dirty.
export function toWire(type: BroadcastType, d: Draft, items: PlaylistDraftItem[]): Partial<Broadcast> {
  const w: Partial<Broadcast> = {
    name: d.name.trim(),
    description: d.description.trim(),
    webRTCViewerLimit: inputToLimit(d.webRTCViewerLimit),
    hlsViewerLimit: inputToLimit(d.hlsViewerLimit),
    dashViewerLimit: inputToLimit(d.dashViewerLimit),
  }
  if (type === 'streamSource') {
    w.streamUrl = d.streamUrl.trim()
    w.autoStartStopEnabled = d.autoStartStopEnabled
  }
  if (type === 'ipCamera') {
    // No streamUrl: the server reconnects over ONVIF from the host + credentials and overwrites
    // whatever we send. A blank credential means "keep the stored one", so omit it rather than
    // send "". See RISKS.md.
    w.ipAddr = d.ipAddr.trim()
    if (d.username.trim()) w.username = d.username.trim()
    if (d.password) w.password = d.password
    w.autoStartStopEnabled = d.autoStartStopEnabled
  }
  if (type === 'playlist') {
    w.playListItemList = toPlayListItems(items)
    w.playlistLoopEnabled = d.playlistLoopEnabled
    w.plannedStartDate = fromScheduleInput(d.schedule)
  }
  return w
}

// playListItemList is the only object-valued key; everything else compares by value.
const differs = (a: unknown, b: unknown) =>
  typeof b === 'object' ? JSON.stringify(a) !== JSON.stringify(b) : a !== b

export const diff = (from: Partial<Broadcast>, to: Partial<Broadcast>) =>
  Object.fromEntries(
    Object.entries(to).filter(([k, v]) => differs(from[k as keyof Broadcast], v)),
  ) as Partial<Broadcast>
