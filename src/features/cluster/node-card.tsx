import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { MeterBar } from '@/components/shared/meter-bar'
import { Pill, type PillTone } from '@/components/shared/pill'
import { threshColor } from '@/components/shared/ring'
import { cn } from '@/lib/utils'
import { fmtAgo, fmtBytes, fmtCount } from '@/lib/format'
import type { NodeHealth, NodeView } from './types'

const MB = 1024 * 1024

// Mirrors the backend cap (ClusterRestServiceV2.MAX_NODE_NOTE_LENGTH) so an over-long note
// can't be typed or pasted only to be rejected on save.
const NOTE_MAX_LENGTH = 500

const HEALTH: Record<NodeHealth, { dot: string; tone: PillTone; label: string }> = {
  healthy: { dot: 'var(--ok)', tone: 'ok', label: 'healthy' },
  warn: { dot: 'var(--warn)', tone: 'warn', label: 'warn' },
  dead: { dot: 'var(--fg-3)', tone: 'neutral', label: 'offline' },
}

type Props = {
  node: NodeView
  note: string
  dirty: boolean
  onNote: (id: string, note: string) => void
  onCopyIp: (ip: string) => void
  onShowLogs: (ip: string) => void
}

export function NodeCard({ node, note, dirty, onNote, onCopyIp, onShowLogs }: Props) {
  const dead = node.status === 'dead'
  const h = HEALTH[node.health]
  const [editing, setEditing] = useState(false)

  return (
    <Card className={cn('p-4 flex flex-col gap-3.5 transition-opacity', dead && 'opacity-60')}>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => onCopyIp(node.ip)} title="Copy IP" className="group/ip flex items-center gap-2 min-w-0 text-left">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: h.dot }} />
          <span className="text-[13px] font-mono text-[var(--fg)] truncate group-hover/ip:text-[var(--accent)] transition-colors">{node.ip}</span>
          <Icon name="copy" size={11} className="text-[var(--fg-3)] opacity-0 group-hover/ip:opacity-100 transition-opacity shrink-0" />
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10.5px] text-[var(--fg-3)] inline-flex items-center gap-1 tabular-nums"><Icon name="clock" size={10} /> {fmtAgo(node.lastUpdateTime)}</span>
          <Pill tone={h.tone} dot>{h.label}</Pill>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Meter label="CPU" value={node.cpuPct == null ? '-' : `${node.cpuPct}%`} pct={dead ? 0 : node.cpuPct ?? 0} tone={threshColor(node.cpuPct ?? 0)} />
        <Meter
          label="Memory"
          value={node.memUsedMB == null || node.memTotalMB == null ? '-' : `${fmtBytes(node.memUsedMB * MB)} / ${fmtBytes(node.memTotalMB * MB)}`}
          pct={dead ? 0 : node.memPct ?? 0}
          tone="var(--info)"
        />
        {node.gpuPct != null ? (
          <Meter label="GPU" value={dead ? '-' : `${node.gpuPct}%`} pct={dead ? 0 : node.gpuPct} tone={threshColor(node.gpuPct)} aside={node.gpuModel ?? undefined} />
        ) : (
          <div className="flex items-center justify-between text-[11px] py-px">
            <span className="text-[var(--fg-3)]">GPU</span>
            <span className="text-[var(--fg-3)] italic">No GPU</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--border)]">
        <Stat label="Streams" value={node.streams == null ? '-' : String(node.streams)} />
        <Stat label="Viewers" value={node.viewers == null ? '-' : fmtCount(node.viewers)} />
        <Stat label="DB query" value={`${node.dbQueryMs} ms`} />
      </div>

      {/* Actions + note pinned to the card bottom (mt-auto aligns them across the grid). */}
      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={() => onShowLogs(node.ip)}
          disabled={dead}
          className="h-7 rounded-[6px] text-[11.5px] inline-flex items-center justify-center gap-1.5 text-[var(--fg-2)] border border-[var(--border)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="terminal" size={12} /> Show logs
        </button>

        {editing ? (
          <input
            autoFocus
            defaultValue={note}
            maxLength={NOTE_MAX_LENGTH}
            onBlur={e => { onNote(node.id, e.target.value); setEditing(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onNote(node.id, e.currentTarget.value); setEditing(false) }
              if (e.key === 'Escape') setEditing(false)
            }}
            placeholder="Add a note for this node…"
            className="w-full px-2 py-1.5 text-[11.5px] bg-[var(--bg)] border border-[var(--accent)] rounded-[5px] outline-none text-[var(--fg-2)]"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Click to edit note"
            className="w-full px-2 py-1.5 rounded-[5px] bg-[var(--bg-2)] border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-3)] transition-colors flex items-center gap-1.5 text-left"
          >
            <Icon name="edit" size={10} className="text-[var(--fg-3)] shrink-0" />
            <span className={cn('text-[11.5px] flex-1 truncate', note ? 'text-[var(--fg-2)]' : 'text-[var(--fg-3)]')}>
              {note || 'Add a note for this node…'}
            </span>
            {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)] shrink-0" title="Unsaved" />}
          </button>
        )}
      </div>
    </Card>
  )
}

function Meter({ label, value, pct, tone, aside }: { label: string; value: string; pct: number; tone: string; aside?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
        <span className="text-[var(--fg-3)] inline-flex items-center gap-1.5 min-w-0">
          {label}
          {aside && <span className="text-[10px] text-[var(--fg-3)] font-mono truncate">· {aside}</span>}
        </span>
        <span className="font-mono tabular-nums text-[var(--fg-2)] shrink-0">{value}</span>
      </div>
      <MeterBar pct={pct} tone={tone} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-[var(--fg-3)]">{label}</div>
      <div className="text-[13px] font-mono tabular-nums text-[var(--fg)] truncate">{value}</div>
    </div>
  )
}
