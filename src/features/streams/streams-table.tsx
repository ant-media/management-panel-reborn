import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Icon } from '@/components/ui/icon'
import { ProtocolBadge } from '@/components/shared/protocol-badge'
import { cn } from '@/lib/utils'
import { fmtBitrate, fmtCount, fmtStreamDuration } from '@/lib/format'
import { ActionMenu, type MenuItem } from '@/components/shared/action-menu'
import { CopyChip } from '@/components/shared/copy-chip'
import { Tooltip } from '@/components/shared/tooltip'
import { SortableTh } from '@/components/shared/sortable-header'
import { Thumb } from './thumb'
import { StreamStatus } from './stream-status'
import { playPageUrl } from './url-builder'
import { STREAM_ACTIONS, streamAction, type StreamAction } from './stream-actions'
import { displayName, isLive, totalViewers, type Broadcast } from './types'
import type { SortDir, SortKey } from './use-broadcasts'

// Max width for the name / stream-id cell before it ellipsizes (CSS truncation).
// Bounded (not fill-all) so a long id doesn't sprawl on wide screens; leaner when
// the table is compact. Full value stays reachable (copy button + hover title).
const NAME_MAX_W = 'max-w-[220px]'
const NAME_MAX_W_COMPACT = 'max-w-[180px]'

type Props = {
  appName: string
  broadcasts: Broadcast[] | null
  isLoading: boolean
  selected: Set<string>
  onToggle: (id: string, range: boolean) => void   // range = shift held → select span
  onToggleAll: () => void
  sortKey: SortKey | null
  sortDir: SortDir
  onSort: (k: SortKey) => void
  hasPreview: boolean
  onRowClick?: (b: Broadcast) => void
  buildRowMenu: (b: Broadcast) => MenuItem[]
  onAction: (b: Broadcast, action: StreamAction) => void
  onPlay: (b: Broadcast) => void
  // A mutation is in flight: gate the action buttons so rapid clicks don't fan out.
  busy?: boolean
  // Compact (drawer docked): drop checkbox/thumb/Created + the inline action
  // button, keep the ⋯ menu. activeId = the open row.
  compact?: boolean
  activeId?: string | null
}

export function StreamsTable({
  appName, broadcasts, isLoading,
  selected, onToggle, onToggleAll,
  sortKey, sortDir, onSort,
  hasPreview, onRowClick, buildRowMenu, onAction, onPlay,
  busy = false, compact = false, activeId = null,
}: Props) {
  const allSelected = broadcasts != null && broadcasts.length > 0 && broadcasts.every(b => selected.has(b.streamId))
  const cols = compact ? 5 : 9

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-[var(--card)] z-10">
          <tr className="text-[11px] uppercase tracking-wider text-[var(--fg-3)] border-b border-[var(--border)]">
            {!compact && (
              <th className="text-left px-4 py-2 w-8">
                <Checkbox checked={allSelected} onChange={onToggleAll} />
              </th>
            )}
            {!compact && <th className="text-left font-medium px-3 py-2 w-[64px]" />}
            <SortableTh<SortKey> k="name" label="Stream" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableTh<SortKey> k="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="text-right font-medium px-3 py-2 w-[100px]">Viewers</th>
            {!compact && <th className="text-right font-medium px-3 py-2 w-[110px]">Bitrate</th>}
            {!compact && <th className="text-right font-medium px-3 py-2 w-[110px]">Duration</th>}
            <SortableTh<SortKey> k="date" label="Created" align="right" width="w-[140px]" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className={cn('text-right font-medium px-3 py-2', compact ? 'w-12' : 'w-[80px]')} />
          </tr>
        </thead>
        <tbody>
          {broadcasts?.map(b => (
            <Row
              key={b.streamId}
              appName={appName}
              broadcast={b}
              selected={selected.has(b.streamId)}
              active={activeId != null && b.streamId === activeId}
              compact={compact}
              hasPreview={hasPreview}
              busy={busy}
              onToggle={range => onToggle(b.streamId, range)}
              onRowClick={onRowClick ? () => onRowClick(b) : undefined}
              menu={buildRowMenu(b)}
              onAction={action => onAction(b, action)}
              onPlay={() => onPlay(b)}
            />
          ))}
          {broadcasts != null && broadcasts.length === 0 && (
            <tr>
              <td colSpan={cols} className="px-5 py-12 text-center text-[12px] text-[var(--fg-3)]">
                {isLoading ? 'Loading streams…' : 'No streams match these filters.'}
              </td>
            </tr>
          )}
          {broadcasts == null && (
            <tr>
              <td colSpan={cols} className="px-5 py-12 text-center text-[12px] text-[var(--fg-3)]">
                {isLoading ? 'Loading streams…' : '-'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Row({
  appName, broadcast, selected, active, compact, hasPreview, busy, onToggle, onRowClick, menu, onAction, onPlay,
}: {
  appName: string
  broadcast: Broadcast
  selected: boolean
  active: boolean
  compact: boolean
  hasPreview: boolean
  busy: boolean
  onToggle: (range: boolean) => void
  onRowClick?: () => void
  menu: MenuItem[]
  onAction: (action: StreamAction) => void
  onPlay: () => void
}) {
  const live = isLive(broadcast.status)
  const viewers = totalViewers(broadcast)
  const name = displayName(broadcast)
  const action = streamAction(broadcast)

  return (
    <tr
      onClick={onRowClick}
      // Middle-click opens the HLS player in a new tab; preventDefault on mousedown kills the autoscroll cursor.
      onMouseDown={e => { if (e.button === 1) e.preventDefault() }}
      onAuxClick={e => {
        if (e.button !== 1) return
        e.preventDefault()
        window.open(playPageUrl(appName, broadcast.streamId, { playOrder: 'hls' }), '_blank', 'noopener')
      }}
      className={cn(
        'group border-b border-[var(--border)] transition-colors',
        onRowClick && 'cursor-pointer',
        active ? 'bg-[var(--accent-bg)]'
          : selected ? 'bg-[var(--bg-2)]'
          : onRowClick && 'hover:bg-[var(--bg-2)]',
      )}
    >
      {!compact && (
        <td className="pl-4 pr-1 py-2 select-none" onClick={e => e.stopPropagation()}>
          <Checkbox checked={selected} onChange={(_, e) => onToggle(e.shiftKey)} />
        </td>
      )}
      {!compact && (
        <td className="px-1 py-2">
          <Thumb appName={appName} broadcast={broadcast} hasPreview={hasPreview} onPlay={onPlay} />
        </td>
      )}
      <td className="px-3 py-2 min-w-0">
        <div className={cn('flex items-center gap-1.5', compact ? NAME_MAX_W_COMPACT : NAME_MAX_W)}>
          <span
            className="font-medium text-[var(--fg)] leading-tight truncate min-w-0"
            title={name}
          >{name}</span>
          <CopyChip value={name} showValue={false} size="sm" className="shrink-0" />
        </div>
        <div className={cn('flex items-center gap-1.5 mt-0.5', compact ? NAME_MAX_W_COMPACT : NAME_MAX_W)}>
          {broadcast.publishType && <span className="shrink-0"><ProtocolBadge type={broadcast.publishType} /></span>}
          <CopyChip value={broadcast.streamId} size="sm" />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StreamStatus broadcast={broadcast} />
        </div>
        {/* Encoding speed sits under the badge for active streams (1.00x = realtime).
            speed > 0 hides the meaningless 0 reported for WebRTC / just-started ingest. */}
        {live && broadcast.speed != null && broadcast.speed > 0 ? (
          <Tooltip
            content={`Encoding speed ${broadcast.speed.toFixed(2)}x, ${
              broadcast.speed < 0.95
                ? 'falling behind realtime'
                : broadcast.speed > 1.1
                  ? 'above realtime speed'
                  : 'keeping up with realtime'
            }`}
          >
            <div className="inline-block mt-1 rounded px-1 -mx-1 text-[10.5px] text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-3)]">
              Speed: <span className="font-mono">{broadcast.speed.toFixed(2)}x</span>
            </div>
          </Tooltip>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right">
        {live
          ? <HoverValue className="font-mono tabular-nums text-[var(--fg)]">{fmtCount(viewers)}</HoverValue>
          : <span className="text-[var(--fg-3)]">-</span>}
      </td>
      {!compact && (
        <td className="px-3 py-2 text-right">
          {live
            ? <HoverValue className="font-mono tabular-nums text-[var(--fg-2)]">{fmtBitrate(broadcast.bitrate ?? 0)}</HoverValue>
            : <span className="text-[var(--fg-3)]">-</span>}
        </td>
      )}
      {!compact && (
        <td className="px-3 py-2 text-right text-[11.5px]">
          {live || (broadcast.duration ?? 0) > 0
            ? <HoverValue className="font-mono tabular-nums text-[var(--fg-2)]">{fmtStreamDuration(liveDurationMs(broadcast, live))}</HoverValue>
            : <span className="text-[var(--fg-3)]">-</span>}
        </td>
      )}
      <td className="px-3 py-2 text-right text-[var(--fg-3)] font-mono tabular-nums text-[11.5px]">
        {broadcast.date ? new Date(broadcast.date).toLocaleDateString() : '-'}
      </td>
      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
        <div className="inline-flex items-center gap-0.5">
          {/* Slot is reserved even when the row offers no action, so ⋯ keeps a constant x down the column. */}
          {!compact && (
            <span className="inline-flex w-6 justify-center">
              {action && (
                <Tooltip content={STREAM_ACTIONS[action].label} delay={0} focusable={false}>
                  <Button variant="ghost" size="iconSm" aria-label={STREAM_ACTIONS[action].label} disabled={busy} onClick={() => onAction(action)}>
                    <Icon name={STREAM_ACTIONS[action].icon} size={13} className={STREAM_ACTIONS[action].tint} />
                  </Button>
                </Tooltip>
              )}
            </span>
          )}
          <ActionMenu items={menu} />
        </div>
      </td>
    </tr>
  )
}

// Subtle hover chip behind a live value, mirroring the prototype's data cells.
function HoverValue({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-[var(--bg-3)]', className)}>
      {children}
    </span>
  )
}

// Live uptime ticks from startTime; off-air falls back to the stored duration.
// Kept out of render so the Date.now() read doesn't trip react-hooks/purity.
function liveDurationMs(b: Broadcast, live: boolean): number {
  if (live && b.startTime) return Date.now() - b.startTime
  return b.duration ?? 0
}
