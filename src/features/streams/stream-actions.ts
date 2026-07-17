import { useCallback, useState } from 'react'
import type { IconName } from '@/components/ui/icon'
import { resultError } from '@/lib/api'
import type { Toast } from '@/lib/use-toast'
import type { AppSettings } from '@/features/apps/use-app-settings'
import { useBroadcastActions } from './use-broadcast-actions'
import { isLive, isStartable, type Broadcast } from './types'

export type RecordType = 'mp4' | 'webm'
type BroadcastApi = ReturnType<typeof useBroadcastActions>

// The row button, the ⋯ menu and the drawer header all resolve and run their action here, so the
// three can never drift apart again (they did: a live publisher used to show a red "Stop" wearing
// an eye icon that only opened the drawer).

export type StreamAction = 'start' | 'stop' | 'forceStop'

// The one action a stream offers, or null when it offers none (VoD, idle publisher).
// Publishers are never plain-stopped, only force-stopped, behind a confirmation.
export const streamAction = (b: Broadcast): StreamAction | null => {
  if (isStartable(b)) return isLive(b.status) ? 'stop' : 'start'
  if (b.type === 'liveStream' && isLive(b.status)) return 'forceStop'
  return null
}

// `short` is for the drawer's action tiles, where "Force Stop Ingest" would wrap on a phone;
// the full label still rides the tooltip. Tints are literal class strings, not a tone enum,
// because Tailwind only keeps what it can see.
export const STREAM_ACTIONS: Record<StreamAction, { label: string; short: string; icon: IconName; tint: string }> = {
  start:     { label: 'Start',             short: 'Start',      icon: 'play',  tint: 'text-[var(--ok)]' },
  stop:      { label: 'Stop',              short: 'Stop',       icon: 'stop',  tint: 'text-[var(--danger)]' },
  forceStop: { label: 'Force Stop Ingest', short: 'Force Stop', icon: 'power', tint: 'text-[var(--danger)]' },
}

type Flash = (kind: Toast['kind'], message: string) => void

// Owns execution for every call site. forceStop cuts a live publisher off mid-broadcast, so it
// defers to <ForceStopModal>, which confirms and then runs the same stop.
export function useStreamActions(appName: string, flash: Flash, refresh: () => void) {
  const api = useBroadcastActions(appName)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<Broadcast | null>(null)

  const run = useCallback((b: Broadcast, action: StreamAction) => {
    if (action === 'forceStop') { setConfirming(b); return }
    setBusy(true)
    void api[action](b.streamId).then(res => {
      setBusy(false)
      // A start that dies on its source (unreadable file, dead URL) answers `success:false` with an
      // empty message and logs the real reason server-side, so the fallback carries the whole
      // explanation. Point a failed start at the source, which is what it usually is; a failed stop
      // has no source to blame.
      flash(res.success ? 'ok' : 'err', res.success
        ? `${action === 'start' ? 'Started' : 'Stopped'} ${b.streamId}`
        : resultError(res, action === 'start'
          ? `Could not start ${b.streamId}. The server gave no reason. Check that its source is reachable and playable, then the server logs.`
          : `Could not stop ${b.streamId}. The server gave no reason. Check the server logs.`))
      if (res.success) refresh()
    })
  }, [api, flash, refresh])

  const dismissConfirm = useCallback(() => setConfirming(null), [])

  return { run, busy, confirming, dismissConfirm }
}

// Shared by the drawer's Recording section and the row ⋯ menu, which had drifted on both the guard
// and the wording. Live ⇒ start/stop now, offline ⇒ arm the next broadcast. The caller owns its
// busy flag and decides what to refresh.
export async function recordStream(
  api: BroadcastApi,
  b: Broadcast,
  type: RecordType,
  enable: boolean,
  settings: AppSettings | null,
  flash: Flash,
): Promise<boolean> {
  // Block only on a loaded settings POJO with the codec off; unknown ⇒ let the backend decide.
  const encoder = type === 'mp4' ? 'h264Enabled' : 'vp8Enabled'
  if (enable && settings && !settings[encoder]) {
    flash('err', `Enable the ${type === 'mp4' ? 'H.264' : 'VP8'} encoder in App Settings first`)
    return false
  }

  const res = await api.record(b.streamId, enable, type)
  const verb = isLive(b.status) ? (enable ? 'started' : 'stopped') : (enable ? 'enabled' : 'disabled')
  flash(res.success ? 'ok' : 'err', res.success
    ? `${type.toUpperCase()} recording ${verb}`
    : resultError(res, `Could not change ${type.toUpperCase()} recording. The server gave no reason. Check the server logs.`))
  return res.success
}
