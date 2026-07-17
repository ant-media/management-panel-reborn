import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { CodeChip } from '@/components/shared/code-chip'
import { DangerCallout } from '@/components/shared/danger-callout'
import { FormError } from '@/components/shared/form'
import { resultError } from '@/lib/api'
import { isLive, type Broadcast } from '../types'
import { useBroadcastActions } from '../use-broadcast-actions'
import {
  diff, toDraft, toDraftItems, toWire,
  LIMIT_MAX_DIGITS, STREAM_URL_HINT, STREAM_URL_RE, VIEWER_LIMITS, type Draft,
} from './draft'
import { FieldLabel, OnvifCameraHostField, TEXTAREA_CLS, TextField, ToggleRow } from './fields'
import { PlaylistItemsEditor } from './playlist-items'

type Props = {
  appName: string
  broadcast: Broadcast
  onClose: () => void
  onSaved: () => void
}

export function EditStreamModal({ appName, broadcast, onClose, onSaved }: Props) {
  const actions = useBroadcastActions(appName)
  const [draft, setDraft] = useState(() => toDraft(broadcast))
  const [items, setItems] = useState(() => toDraftItems(broadcast))
  const [busy, setBusy] = useState(false)
  // Carries both the server's refusal and the one check we can only make on submit.
  const [error, setError] = useState<string | null>(null)
  // Picker up: ignore Escape/backdrop, or one Escape closes the whole stack.
  const [pickerOpen, setPickerOpen] = useState(false)
  const descId = useId()

  const { type, status, streamId } = broadcast
  const pulled = type === 'streamSource' || type === 'ipCamera'
  // The backend stops, patches and restarts a live pulled source, whatever the field
  // (RestServiceBase.updateStreamSource, gated on broadcasting|preparing = isLive).
  // Publishers and playlists are patched in place.
  const restarts = pulled && isLive(status)

  // The seed is the initial state, captured once: this modal is mounted on demand with a
  // snapshot, so a 5s list poll can never re-seed it and stomp what is being typed.
  const [seed] = useState(() => toWire(type, draft, items))
  const patch = diff(seed, toWire(type, draft, items))
  const dirty = Object.keys(patch).length > 0

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }))

  // Validate the patch, not the draft: we only police what we are about to send, so an odd
  // stored value (a 0 limit, a schedule already in the past) can't block an unrelated edit.
  // The blank-row check is the exception, and safe: toDraftItems drops stored blanks, so an
  // empty row is always one the user just added.
  const validation =
    patch.streamUrl === '' ? 'Enter the source URL to pull from.'
    : patch.streamUrl && !STREAM_URL_RE.test(patch.streamUrl) ? STREAM_URL_HINT
    : patch.ipAddr === '' ? 'Camera host is required.'
    : items.some(it => !it.streamUrl.trim()) ? 'Every playlist item needs a URL.'
    : patch.playListItemList?.length === 0 ? 'Add at least one playlist item.'
    : VIEWER_LIMITS.some(([k]) => patch[k] === 0) ? 'Viewer limits must be 1 or more. Leave blank for unlimited.'
    : null
  const canSubmit = dirty && !validation && !busy

  const submit = async () => {
    if (!canSubmit) return
    // Checked here, not in `validation`: "future" only means anything at the instant of the
    // save. A past date arms no timer (schedulePlayList) and the backend says nothing.
    if (patch.plannedStartDate && patch.plannedStartDate * 1000 <= Date.now()) {
      setError('The schedule must be in the future.')
      return
    }
    setBusy(true); setError(null)
    const res = await actions.update(streamId, patch)
    setBusy(false)
    if (res.success) { onSaved(); return }
    // A pulled source is stopped *before* the patch is applied, so a rejected save (bad
    // camera credentials, unreachable URL) leaves it down. Say so; the server won't.
    const reason = resultError(res, 'Could not save the stream. The server gave no reason. Check the server logs.')
    setError(restarts
      ? `${reason} The stream was stopped to apply the change and may not have restarted; check its status.`
      : reason)
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy && !pickerOpen}
      width="lg"
      title="Edit stream"
      icon="edit"
      description={<CodeChip>{streamId}</CodeChip>}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" onClick={submit} disabled={!canSubmit}>
            {busy ? 'Saving…' : restarts ? 'Save and restart' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={e => { e.preventDefault(); void submit() }}
        className="flex flex-col gap-5 max-h-[64vh] overflow-y-auto pr-1"
      >
        {restarts && (
          <DangerCallout>
            This source is live. Saving stops and restarts it, so viewers drop for a few seconds.
          </DangerCallout>
        )}

        <TextField
          label="Display name" optional autoFocus
          value={draft.name} onChange={v => set('name', v)}
          placeholder={streamId} disabled={busy} maxLength={128}
        />

        {type === 'streamSource' && (
          <TextField
            label="Source URL" hint="Applies on the next start unless the source is live."
            value={draft.streamUrl} onChange={v => set('streamUrl', v)}
            placeholder="rtmp://… · rtsp://… · srt://… · https://…/.m3u8" disabled={busy} mono
          />
        )}

        {type === 'ipCamera' && (
          <div className="flex flex-col gap-4">
            <OnvifCameraHostField appName={appName} value={draft.ipAddr} onChange={v => set('ipAddr', v)} disabled={busy} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Username" value={draft.username} onChange={v => set('username', v)} placeholder="admin" disabled={busy} mono />
              <TextField
                label="Password" type="password" hint="Blank keeps the current one."
                value={draft.password} onChange={v => set('password', v)} disabled={busy} mono
              />
            </div>
          </div>
        )}

        {type === 'playlist' && (
          <>
            <div>
              <FieldLabel hint="Full video URLs, played in order. Pick from this app's VoDs or paste any HTTP(S) URL.">Playlist items</FieldLabel>
              <PlaylistItemsEditor appName={appName} items={items} onChange={setItems} disabled={busy} onModalToggle={setPickerOpen} />
            </div>
            <TextField
              label="Schedule" type="datetime-local" optional hint="Starts the playlist automatically. Blank plays it on demand."
              value={draft.schedule} onChange={v => set('schedule', v)} disabled={busy}
            />
          </>
        )}

        <div>
          <FieldLabel htmlFor={descId} optional>Description</FieldLabel>
          <textarea
            id={descId}
            value={draft.description}
            onChange={e => set('description', e.target.value)}
            placeholder="What this stream is used for…"
            rows={2}
            maxLength={500}
            disabled={busy}
            className={TEXTAREA_CLS}
          />
        </div>

        <div>
          <FieldLabel hint="Blank means unlimited.">Viewer limits</FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            {VIEWER_LIMITS.map(([k, label]) => (
              <TextField
                key={k} label={label}
                value={draft[k]} onChange={v => set(k, v.replace(/\D/g, ''))}
                placeholder="Unlimited" disabled={busy} maxLength={LIMIT_MAX_DIGITS}
              />
            ))}
          </div>
        </div>

        {(pulled || type === 'playlist') && (
          <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-3">
            <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--fg-3)]">Options</div>
            {pulled && (
              <ToggleRow
                checked={draft.autoStartStopEnabled}
                onChange={v => set('autoStartStopEnabled', v)}
                label="Start and stop with viewers"
                hint="Pull the source only while someone is watching."
              />
            )}
            {type === 'playlist' && (
              <ToggleRow
                checked={draft.playlistLoopEnabled}
                onChange={v => set('playlistLoopEnabled', v)}
                label="Loop the playlist"
              />
            )}
          </div>
        )}

        {validation && <div className="text-[12px] text-[var(--danger)]">{validation}</div>}
        {error && <FormError>{error}</FormError>}
      </form>
    </Modal>
  )
}
