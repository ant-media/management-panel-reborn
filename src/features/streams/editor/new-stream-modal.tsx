import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Icon, type IconName } from '@/components/ui/icon'
import { FormError } from '@/components/shared/form'
import { resultError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useBroadcastActions } from '../use-broadcast-actions'
import type { Broadcast, BroadcastType } from '../types'
import { toPlayListItems, STREAM_URL_HINT, STREAM_URL_RE, type PlaylistDraftItem } from './draft'
import { FieldLabel, OnvifCameraHostField, TEXTAREA_CLS, TextField, ToggleRow } from './fields'
import { PlaylistItemsEditor } from './playlist-items'

// Backend accepts {streamId} as alphanumeric/dashes/underscores; we cap to match
// the Java side and gently coerce typed characters instead of letting an invalid
// streamId reach the wire.
const STREAM_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

// The four real backend stream types (verified against the Angular console + Java
// `AntMediaApplicationAdapter` constants). The prototype's separate "RTMP pull" and
// "Stream source" collapse into one; both are `streamSource` + a pull URL on the wire.
// `note` is a second description line, shown only where a type needs the extra nuance.
type Kind = Exclude<BroadcastType, 'VoD'>
const TYPES: { id: Kind; label: string; icon: IconName; desc: string; note?: string }[] = [
  { id: 'liveStream',   label: 'Live Stream',   icon: 'upload', desc: 'Publish from an encoder, browser, or SDK using WebRTC, RTMP, or SRT.', note: 'The stream stays idle until a publisher connects to this stream ID.' },
  { id: 'streamSource', label: 'Stream source', icon: 'link',   desc: 'Pull a remote RTMP / RTSP / SRT / HLS URL.' },
  { id: 'ipCamera',     label: 'IP camera',     icon: 'camera', desc: 'Connect to an ONVIF / RTSP camera.' },
  { id: 'playlist',     label: 'Playlist',      icon: 'list',   desc: 'Rebroadcast a sequence of VoDs as one live stream.' },
]

type Props = {
  open: boolean
  appName: string | undefined
  onClose: () => void
  onCreated?: (streamId: string) => void
}

export function NewStreamModal({ open, appName, onClose, onCreated }: Props) {
  const actions = useBroadcastActions(appName)
  const [kind, setKind] = useState<Kind>('liveStream')
  const [name, setName] = useState('')
  const [streamId, setStreamId] = useState('')
  const [description, setDescription] = useState('')
  // streamSource
  const [streamUrl, setStreamUrl] = useState('')
  // ipCamera
  const [ipAddr, setIpAddr] = useState('')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  // playlist
  const [items, setItems] = useState<PlaylistDraftItem[]>([])
  // options
  const [startNow, setStartNow] = useState(true)
  const [loop, setLoop] = useState(true)
  const [recordMp4, setRecordMp4] = useState(false)

  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  // Picker up: ignore Escape/backdrop or one Escape closes the whole stack. No
  // reset needed; the picker's overlay makes every close path clear it first.
  const [pickerOpen, setPickerOpen] = useState(false)

  const descId = useId()

  useEffect(() => {
    if (!open) return
    setKind('liveStream'); setName(''); setStreamId(''); setDescription('')
    setStreamUrl(''); setIpAddr(''); setUsername('admin'); setPassword('')
    setItems([])
    setStartNow(true); setLoop(true); setRecordMp4(false)
    setBusy(false); setServerError(null)
  }, [open])

  const trimmedName = name.trim()
  const trimmedId = streamId.trim()
  const idShapeOk = !trimmedId || STREAM_ID_RE.test(trimmedId)
  const validItems = items.filter(it => it.streamUrl.trim())
  const pulled = kind === 'streamSource' || kind === 'ipCamera'
  const activeType = TYPES.find(t => t.id === kind)!

  const validation =
    !idShapeOk ? 'Stream ID: letters, numbers, hyphens, underscores. Up to 128 characters.'
    : kind === 'liveStream' && !trimmedName && !trimmedId ? 'Provide a name or stream ID.'
    : kind === 'streamSource' && !streamUrl.trim() ? 'Enter the source URL to pull from.'
    // The backend runs the same whitelist on create (BroadcastRestService.createBroadcast),
    // and answers a bare "Stream url is not valid". Catch it here, where we can say more.
    : kind === 'streamSource' && !STREAM_URL_RE.test(streamUrl.trim()) ? STREAM_URL_HINT
    : kind === 'ipCamera' && (!ipAddr.trim() || !username.trim() || !password) ? 'Camera host, username, and password are required.'
    : kind === 'playlist' && validItems.length === 0 ? 'Add at least one playlist item.'
    : null
  const canSubmit = !validation && !busy && Boolean(appName)

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true); setServerError(null)
    const payload: Partial<Broadcast> = {
      type: kind,
      name: trimmedName || undefined,
      streamId: trimmedId || undefined,
      description: description.trim() || undefined,
    }
    if (recordMp4) payload.mp4Enabled = 1
    if (kind === 'streamSource') payload.streamUrl = streamUrl.trim()
    if (kind === 'ipCamera') { payload.ipAddr = ipAddr.trim(); payload.username = username.trim(); payload.password = password }
    if (kind === 'playlist') {
      payload.playListItemList = toPlayListItems(items)
      payload.playlistLoopEnabled = loop
    }
    const res = await actions.create(payload, { autoStart: pulled ? startNow : undefined })
    setBusy(false)
    if (res.success) { onCreated?.(res.id ?? trimmedId); onClose() }
    else setServerError(resultError(res, 'Could not create the stream. The server gave no reason. Check the server logs.'))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy && !pickerOpen}
      width="lg"
      title="New live stream"
      icon="video"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" onClick={submit} disabled={!canSubmit}>
            {busy ? 'Creating…' : 'Create stream'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={e => { e.preventDefault(); void submit() }}
        className="flex flex-col gap-5 max-h-[64vh] overflow-y-auto pr-1"
      >
        {/* Type: segmented control + the selected type's description (no separate
            label; the control is self-evident and the description explains it) */}
        <div>
          <div role="radiogroup" aria-label="Stream type" className="flex gap-1 p-1 rounded-[9px] bg-[var(--bg-2)] border border-[var(--border)]">
            {TYPES.map(t => {
              const active = kind === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setKind(t.id)}
                  disabled={busy}
                  className={cn(
                    'flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-[6px] px-2 py-2 text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50',
                    active
                      ? 'bg-[var(--card)] text-[var(--fg)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'text-[var(--fg-3)] hover:text-[var(--fg)]',
                  )}
                >
                  <Icon name={t.icon} size={13} className={cn('shrink-0', active && 'text-[var(--accent)]')} />
                  <span className="truncate">{t.label}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[12px] text-[var(--fg-2)] leading-relaxed">{activeType.desc}</p>
          {activeType.note && <p className="mt-1.5 text-[12px] text-[var(--fg-3)] leading-relaxed">{activeType.note}</p>}
        </div>

        {/* Identity */}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Stream ID" optional hint="Auto-generated if blank." autoFocus
            value={streamId}
            onChange={v => setStreamId(v.replace(/[^A-Za-z0-9_-]/g, ''))}
            placeholder="e.g. main-stage-cam" disabled={busy} maxLength={128} mono
          />
          <TextField
            label="Display name" optional
            value={name} onChange={setName}
            placeholder="Main Stage Camera" disabled={busy} maxLength={128}
          />
        </div>

        {/* Type-specific source config */}
        {kind === 'streamSource' && (
          <TextField
            label="Source URL" hint="AMS pulls and keeps this source alive."
            value={streamUrl} onChange={setStreamUrl}
            placeholder="rtmp://… · rtsp://… · srt://… · https://…/.m3u8" disabled={busy} mono
          />
        )}

        {kind === 'ipCamera' && (
          <div className="flex flex-col gap-4">
            <OnvifCameraHostField appName={appName} value={ipAddr} onChange={setIpAddr} disabled={busy} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Username" value={username} onChange={setUsername} placeholder="admin" disabled={busy} mono />
              <TextField label="Password" type="password" value={password} onChange={setPassword} disabled={busy} mono />
            </div>
          </div>
        )}

        {kind === 'playlist' && (
          <div>
            <FieldLabel hint="Full video URLs, played in order. Pick from this app's VoDs or paste any HTTP(S) URL.">Playlist items</FieldLabel>
            <PlaylistItemsEditor appName={appName} items={items} onChange={setItems} disabled={busy} onModalToggle={setPickerOpen} />
          </div>
        )}

        {/* Description */}
        <div>
          <FieldLabel htmlFor={descId} optional>Description</FieldLabel>
          <textarea
            id={descId}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this stream is used for…"
            rows={2}
            maxLength={500}
            disabled={busy}
            className={TEXTAREA_CLS}
          />
        </div>

        {/* Options */}
        <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-3">
          <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--fg-3)]">Options</div>
          {pulled && (
            <ToggleRow
              checked={startNow}
              onChange={setStartNow}
              label="Start fetching immediately"
              hint="Otherwise the source is created idle. Start it later from the list."
            />
          )}
          {kind === 'playlist' && (
            <ToggleRow checked={loop} onChange={setLoop} label="Loop the playlist" />
          )}
          <ToggleRow checked={recordMp4} onChange={setRecordMp4} label="Record as MP4" />
        </div>

        {validation && <div className="text-[12px] text-[var(--danger)]">{validation}</div>}
        {serverError && <FormError>{serverError}</FormError>}
      </form>
    </Modal>
  )
}
