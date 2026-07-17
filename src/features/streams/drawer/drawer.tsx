import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api'
import { fmtDuration } from '@/lib/format'
import { ActionMenu, type MenuItem } from '@/components/shared/action-menu'
import { CopyChip } from '@/components/shared/copy-chip'
import { EndpointsSection } from '../endpoints-section'
import { StreamStatus } from '../stream-status'
import { Thumb } from '../thumb'
import { type StreamAction } from '../stream-actions'
import { useStreamDetail } from '../use-stream-detail'
import { displayName, isLive, recordingOn, type Broadcast } from '../types'
import { StreamActionBar } from './action-bar'
import { Metrics, type MetricKey } from './metrics'
import { RecordingSection } from './recording'
import { Section } from './section'

type Props = {
  appName: string
  streamId: string
  hasPreview: boolean
  // inline = docked beside the table; overlay = full-screen (narrow).
  mode: 'inline' | 'overlay'
  // Must be stable: the ESC/focus effect re-runs on it, and the parent re-renders every poll.
  onClose: () => void
  onFlash: (kind: 'ok' | 'err', message: string) => void
  onMutated: () => void
  onPlay: (b: Broadcast) => void
  // Start/stop, edit and delete run in the parent, so the row and the drawer share one code path.
  onAction: (b: Broadcast, action: StreamAction) => void
  onEdit: (b: Broadcast) => void
  onDelete: (b: Broadcast) => void
  busy: boolean
  // Same items as the row's ⋯ menu; built by the parent to keep them in sync.
  buildMenu: (b: Broadcast) => MenuItem[]
  // Owned by the tab: this drawer remounts per stream, the open chart shouldn't.
  metric: MetricKey | null
  onMetric: (key: MetricKey | null) => void
}

export function StreamDetailDrawer({
  appName, streamId, hasPreview, mode, onClose, onFlash, onMutated, onPlay, onAction, onEdit, onDelete, busy, buildMenu,
  metric, onMetric,
}: Props) {
  const { broadcast, viewers, webrtcClients, viewerStatsEnabled, settings, history, error, isLoading, refresh } =
    useStreamDetail(appName, streamId)

  const panelRef = useRef<HTMLElement>(null)
  const overlay = mode === 'overlay'

  // ESC + focus-into-panel in both modes; scroll-lock only for the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    if (overlay) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
    }
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, overlay])

  const live = isLive(broadcast?.status)
  const mp4On = recordingOn(broadcast?.mp4Enabled, settings?.mp4MuxingEnabled)
  const webmOn = recordingOn(broadcast?.webMEnabled, settings?.webMMuxingEnabled)
  const endpoints = broadcast?.endPointList ?? []
  const forwarding = endpoints.filter(e => e.status === 'broadcasting').length

  return (
    <>
      {overlay && <div onClick={onClose} className="fixed inset-0 z-40 bg-black/30" aria-hidden />}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={overlay}
        aria-label={`Stream ${displayName(broadcast ?? ({ streamId } as Broadcast))}`}
        className={cn(
          'bg-[var(--card)] flex flex-col outline-none',
          overlay
            ? 'fixed inset-y-0 right-0 z-50 w-full sm:w-[580px] border-l border-[var(--border)] shadow-2xl'
            : 'h-full w-full',
        )}
      >
        {broadcast == null ? (
          <EmptyState loading={isLoading} error={error} streamId={streamId} onClose={onClose} />
        ) : (
          <>
            <Header
              appName={appName}
              broadcast={broadcast}
              hasPreview={hasPreview}
              live={live}
              menu={buildMenu(broadcast)}
              onClose={onClose}
            />

            <div className="flex-1 overflow-y-auto">
              <StreamActionBar
                broadcast={broadcast}
                busy={busy}
                onPlay={() => onPlay(broadcast)}
                onAction={action => onAction(broadcast, action)}
                onEdit={() => onEdit(broadcast)}
                onDelete={() => onDelete(broadcast)}
              />

              <Metrics
                data={{ broadcast, live, viewers, viewerStatsEnabled, webrtcClients, history }}
                selected={metric}
                onSelect={k => onMetric(metric === k ? null : k)}
              />

              {/* `meta` keeps a closed section honest: a running recording or a dead endpoint
                  still shows in its header. */}
              <Section id="recording" title="Recording" meta={recordingMeta(mp4On, webmOn)}>
                <RecordingSection
                  appName={appName}
                  broadcast={broadcast}
                  mp4On={mp4On}
                  webmOn={webmOn}
                  settings={settings}
                  onFlash={onFlash}
                  onDone={() => { refresh(); onMutated() }}
                />
              </Section>

              <Section
                id="restream"
                title="Re-streaming"
                meta={endpoints.length === 0 ? 'none' : `${forwarding}/${endpoints.length} forwarding`}
              >
                <EndpointsSection
                  appName={appName}
                  streamId={streamId}
                  endpoints={endpoints}
                  onChanged={refresh}
                  flash={onFlash}
                />
              </Section>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

const recordingMeta = (mp4: boolean, webm: boolean) =>
  mp4 && webm ? 'MP4 · WebM' : mp4 ? 'MP4' : webm ? 'WebM' : 'off'

// Out of the component body on purpose: Date.now() in render is impure (react-hooks/purity).
// The 2s poll is what ticks it.
const elapsedMs = (b: Broadcast, live: boolean) =>
  live && b.startTime ? Date.now() - b.startTime : b.duration ?? 0

// Identity only. Actions live in the bar below.
function Header({ appName, broadcast, hasPreview, live, menu, onClose }: {
  appName: string
  broadcast: Broadcast
  hasPreview: boolean
  live: boolean
  menu: MenuItem[]
  onClose: () => void
}) {
  const resolution = live && broadcast.width ? `${broadcast.width}×${broadcast.height}` : null
  const duration = live || broadcast.duration ? fmtDuration(elapsedMs(broadcast, live)) : null

  return (
    <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <Thumb appName={appName} broadcast={broadcast} hasPreview={hasPreview} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <div className="flex items-center gap-1 min-w-0">
              <h2 className="text-[15px] font-medium tracking-tight text-[var(--fg)] truncate max-w-[220px]">{displayName(broadcast)}</h2>
              <CopyChip value={displayName(broadcast)} showValue={false} size="sm" />
            </div>
            <StreamStatus broadcast={broadcast} />
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] text-[var(--fg-3)] font-mono truncate">{broadcast.streamId}</span>
            <CopyChip value={broadcast.streamId} showValue={false} size="sm" />
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-[var(--fg-3)] flex-wrap">
            <span className="px-1 py-px rounded bg-[var(--bg-2)] uppercase tracking-wider">{broadcast.type}</span>
            {resolution && <><span>·</span><span className="font-mono text-[var(--fg-2)]">{resolution}</span></>}
            {duration && <><span>·</span><span className="font-mono">{duration}</span></>}
            {broadcast.originAdress && <><span>·</span><span>origin <span className="font-mono text-[var(--fg-2)]">{broadcast.originAdress}</span></span></>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <ActionMenu items={menu} />
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></Button>
      </div>
    </div>
  )
}

function EmptyState({ loading, error, streamId, onClose }: {
  loading: boolean
  error: Error | null
  streamId: string
  onClose: () => void
}) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--fg)] font-mono truncate">{streamId}</span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></Button>
      </div>
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <div>
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-2)] flex items-center justify-center mb-3">
            <Icon name={error ? 'info' : 'video'} size={20} className="text-[var(--fg-3)]" />
          </div>
          <div className="text-[13px] text-[var(--fg-2)]">
            {loading ? 'Loading stream…' : error ? 'Could not load this stream.' : 'This stream no longer exists.'}
          </div>
          {error && !loading && <div className="text-[11.5px] text-[var(--fg-3)] mt-1">{errorMessage(error, 'No details available.')}</div>}
        </div>
      </div>
    </div>
  )
}
