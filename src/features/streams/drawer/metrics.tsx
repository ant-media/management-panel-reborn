import { useState, type ReactNode } from 'react'
import { Collapse } from '@/components/shared/collapse'
import { ExpandHandle } from '@/components/shared/expand-handle'
import { LineChart } from '@/components/shared/line-chart'
import { Sparkline } from '@/components/shared/sparkline'
import { StatsDisabledNotice } from '@/components/shared/stats-disabled-notice'
import { fmtBitrate, fmtCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StreamMetricsHistory, WebRTCClientStat } from '@/lib/api/endpoints'
import type { ViewerBreakdown } from '../use-stream-detail'
import type { Broadcast } from '../types'

export type MetricKey = 'bitrate' | 'viewers' | 'speed'

type Data = {
  broadcast: Broadcast
  live: boolean
  viewers: ViewerBreakdown | null
  viewerStatsEnabled: boolean
  webrtcClients: WebRTCClientStat[] | null
  history: StreamMetricsHistory
}

// One definition per metric; the tile and the chart both read it, so they cannot disagree.
type Metric = {
  key: MetricKey
  label: string
  title: string
  unit?: string
  color: string
  // Reads 0 when the app's stats are off, so dash it instead of charting a flat zero.
  gated?: boolean
  series: (h: StreamMetricsHistory) => number[]
  value: (d: Data) => string
  yFormat: (n: number) => string
}

const METRICS: Metric[] = [
  {
    key: 'bitrate', label: 'Bitrate', title: 'Ingest bitrate', unit: 'Mbps', color: 'var(--accent)',
    series: h => h.bitrate.map(b => b / 1_000_000),
    value: ({ broadcast, live }) => (live ? fmtBitrate(broadcast.bitrate ?? 0) : '-'),
    yFormat: v => v.toFixed(1),
  },
  {
    key: 'viewers', label: 'Viewers', title: 'Total viewers', color: 'var(--info)', gated: true,
    series: h => h.viewers,
    value: ({ viewers, viewerStatsEnabled }) => (viewerStatsEnabled ? fmtCount(viewers?.total ?? 0) : '-'),
    yFormat: v => fmtCount(Math.round(v)),
  },
  {
    key: 'speed', label: 'Speed', title: 'Ingest speed', color: 'var(--ok)',
    series: h => h.speed,
    value: ({ broadcast, live }) => (live && broadcast.speed != null ? `${broadcast.speed.toFixed(2)}x` : '-'),
    yFormat: v => `${v.toFixed(2)}x`,
  },
]

// Three tiles over one shared chart. The tab owns the selection: this drawer remounts per stream.
export function Metrics({ data, selected, onSelect }: {
  data: Data
  selected: MetricKey | null
  onSelect: (key: MetricKey) => void
}) {
  // Outlives `selected` so the chart is still there to animate out; dropping it would snap shut.
  const [shown, setShown] = useState(selected)
  if (selected && selected !== shown) setShown(selected)

  const chart = METRICS.find(m => m.key === shown) ?? null

  return (
    <>
      <div className="px-5 py-3 grid grid-cols-3 gap-2">
        {METRICS.map(m => (
          <MetricTile
            key={m.key}
            label={m.label}
            color={m.color}
            value={m.value(data)}
            spark={m.gated && !data.viewerStatsEnabled ? [] : m.series(data.history)}
            open={selected === m.key}
            onClick={() => onSelect(m.key)}
          />
        ))}
      </div>

      <Collapse open={selected != null}>
        <div className="px-5 pb-4 pt-3 border-t border-[var(--border)]">
          {chart && <MetricChart metric={chart} data={data} />}
        </div>
      </Collapse>
    </>
  )
}

function MetricTile({ label, value, spark, color, open, onClick }: {
  label: string
  value: ReactNode
  spark: number[]
  color: string
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[8px] border p-2.5 text-left transition-all',
        open
          ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
          : 'border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--border-strong)] hover:-translate-y-px',
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-[var(--fg-3)] mb-0.5">{label}</span>
      <span className="text-[15px] font-mono tabular-nums leading-none text-[var(--fg)]">{value}</span>
      <span className="block h-5 -mx-2.5 -mb-2.5 mt-2">
        {spark.length > 1 && (
          <Sparkline data={spark} full height={20} stroke={color} strokeWidth={1.25} opacity={open ? 0.7 : 0.35} />
        )}
      </span>
      {/* Bare chevron over the sparkline; no band, so it costs no height. */}
      <ExpandHandle open={open} line={false} size={11} growOnHover className="absolute inset-x-0 bottom-0" />
    </button>
  )
}

function MetricChart({ metric, data }: { metric: Metric; data: Data }) {
  const { live, viewers, viewerStatsEnabled, webrtcClients, history } = data
  const disabled = Boolean(metric.gated) && !viewerStatsEnabled
  const series = metric.series(history)

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11.5px] text-[var(--fg-2)]">
          {metric.title}
          {metric.unit && <span className="ml-1 font-mono tabular-nums text-[var(--fg-3)]">{metric.unit}</span>}
        </span>
        {!disabled && <span className="text-[12px] font-mono tabular-nums text-[var(--fg)]">{metric.value(data)}</span>}
      </div>

      {disabled
        ? <StatsDisabledNotice className="h-[140px]" />
        : !live
          ? <Muted>Live history appears while the stream is broadcasting.</Muted>
          : series.length >= 2
            ? <LineChart height={140} series={[{ data: series, color: metric.color }]} yFormat={metric.yFormat} />
            : <div className="h-[140px] flex items-center justify-center text-[11px] text-[var(--fg-3)]">collecting…</div>}

      {metric.key === 'viewers' && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="WebRTC" value={vstat(viewers?.webrtc, viewerStatsEnabled)} />
            <Stat label="HLS" value={vstat(viewers?.hls, viewerStatsEnabled)} />
            <Stat label="DASH" value={vstat(viewers?.dash, viewerStatsEnabled)} />
          </div>
          {live && webrtcClients != null && (
            <div className="mt-2 text-[11px] text-[var(--fg-3)]">
              {webrtcClients.length === 0
                ? 'No active WebRTC players.'
                : <>{webrtcClients.length} WebRTC player{webrtcClients.length === 1 ? '' : 's'} · avg {fmtBitrate(avgMeasured(webrtcClients))}</>}
            </div>
          )}
        </>
      )}
    </>
  )
}

const vstat = (n: number | undefined, enabled: boolean) => (enabled ? fmtCount(n ?? 0) : '-')

const avgMeasured = (clients: WebRTCClientStat[]) =>
  clients.length === 0 ? 0 : clients.reduce((s, c) => s + (c.measuredBitrate ?? 0), 0) / clients.length

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-2.5 rounded-[6px] bg-[var(--bg-2)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--fg-3)] mb-0.5">{label}</div>
      <div className="text-[14px] font-mono tabular-nums text-[var(--fg)]">{value}</div>
    </div>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <div className="h-[140px] flex items-center justify-center text-[11.5px] text-[var(--fg-3)] italic text-center px-4">{children}</div>
}
