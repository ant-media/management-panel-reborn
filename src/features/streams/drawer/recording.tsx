import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/shared/pill'
import type { AppSettings } from '@/features/apps/use-app-settings'
import { recordStream, type RecordType } from '../stream-actions'
import { useBroadcastActions } from '../use-broadcast-actions'
import { isLive, type Broadcast } from '../types'

// Rows only; the mutation itself lives in stream-actions.ts, shared with the row ⋯ menu.
export function RecordingSection({ appName, broadcast, mp4On, webmOn, settings, onFlash, onDone }: {
  appName: string
  broadcast: Broadcast
  mp4On: boolean
  webmOn: boolean
  settings: AppSettings | null
  onFlash: (kind: 'ok' | 'err', message: string) => void
  onDone: () => void
}) {
  const api = useBroadcastActions(appName)
  const [busy, setBusy] = useState(false)
  const live = isLive(broadcast.status)

  // One busy flag for both rows: they mutate the same broadcast.
  const toggle = async (on: boolean, type: RecordType) => {
    setBusy(true)
    const ok = await recordStream(api, broadcast, type, !on, settings, onFlash)
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <div className="space-y-2">
      <RecordRow kind="MP4"  on={mp4On}  live={live} busy={busy} onToggle={() => void toggle(mp4On, 'mp4')} />
      <RecordRow kind="WebM" on={webmOn} live={live} busy={busy} onToggle={() => void toggle(webmOn, 'webm')} />
    </div>
  )
}

function RecordRow({ kind, on, live, busy, onToggle }: {
  kind: string
  on: boolean
  live: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-mono text-[var(--fg-2)] w-11 shrink-0">{kind}</span>
        {on ? <Pill tone="err" dot>recording</Pill> : <Pill tone="neutral">off</Pill>}
      </div>
      <Button variant={on ? 'dangerOutline' : 'outline'} size="sm" onClick={onToggle} disabled={busy}>
        <Icon name="record" size={12} /> {live ? (on ? 'Stop' : 'Start') : (on ? 'Disable' : 'Enable')}
      </Button>
    </div>
  )
}
