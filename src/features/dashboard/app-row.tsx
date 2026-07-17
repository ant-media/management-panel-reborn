import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { LineChart } from '@/components/shared/line-chart'
import { StatsDisabledNotice } from '@/components/shared/stats-disabled-notice'
import { useApi } from '@/lib/api'
import { apps } from '@/lib/api/endpoints'
import { fmtBytes, fmtCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApplicationInfo } from '@/features/apps/use-applications'
import { useViewerStatsEnabled } from '@/features/apps/use-app-settings'

type AppMetricsHistory = { viewers: number[]; streams: number[] }

// Server ring samples every 30s; poll on the slow app-list rhythm, not the 5s live-chart one.
const POLL_MS = 15_000

type Props = {
  app: ApplicationInfo
  onOpen: (name: string) => void
}

// Applications table row. Click toggles a drilldown of per-app trends (viewers / live
// streams) fetched lazily on expand. History is an in-memory ring on the server, so it
// builds up over time and resets on a server restart (see dashboard-widgets.md). Stream
// health has no backend yet, so its slot shows a TODO placeholder.
export function AppRow({ app, onOpen }: Props) {
  const [open, setOpen] = useState(false)
  const { data, error, isLoading } = useApi<Partial<AppMetricsHistory>>(
    signal => apps.metricsHistory(app.name, signal),
    { enabled: open, pollMs: POLL_MS, refetchKey: app.name },
  )

  // viewers come from the DataStore (writeStatsToDatastore); off ⇒ flat 0, so swap the chart.
  const viewersOff = !useViewerStatsEnabled(app.name, open)

  // Normalise so a partial backend response can't crash the charts (each series ⇒ []).
  const series = data ? { viewers: data.viewers ?? [], streams: data.streams ?? [] } : null
  const hasData = !!series && (series.viewers.length > 0 || series.streams.length > 0)
  const peakViewers = series ? Math.round(Math.max(...series.viewers, 0)) : 0

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        className={cn('border-b border-[var(--border)] hover:bg-[var(--bg-2)] cursor-pointer transition-colors', open && 'bg-[var(--bg-2)]')}
      >
        <td className="px-6 py-3 text-[var(--fg-3)] w-10">
          <Icon name="chevron-right" size={14} className={cn('transition-transform', open && 'rotate-90')} />
        </td>
        <td className="px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Icon name="box" size={14} className="text-[var(--fg-3)]" />
            <span className="font-medium text-[var(--fg)]">{app.name}</span>
          </div>
        </td>
        <td className="px-6 py-3 text-right font-mono tabular-nums">
          {app.liveStreamCount > 0
            ? <span className="text-[var(--accent)] font-medium">{app.liveStreamCount}</span>
            : <span className="text-[var(--fg-3)]">0</span>}
        </td>
        <td className="px-6 py-3 text-right font-mono tabular-nums text-[var(--fg-2)]">{app.vodCount}</td>
        <td className="px-6 py-3 text-right font-mono tabular-nums text-[var(--fg-2)]">{fmtBytes(app.storage)}</td>
        <td className="px-6 py-3 text-right" onClick={e => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={() => onOpen(app.name)}>
            Go to app <Icon name="arrow-right" size={12} />
          </Button>
        </td>
      </tr>
      {open && (
        <tr className="bg-[var(--bg-2)] border-b border-[var(--border)]">
          <td colSpan={6} className="px-6 py-5">
            {series && hasData ? (
              <>
                <div className="flex items-center gap-3 mb-4 text-[12px]">
                  <span className="text-[var(--fg-3)]">Last 12 hours</span>
                  <span className="text-[var(--border-strong)]">·</span>
                  {viewersOff
                    ? <span className="text-[var(--fg-3)]">viewers not collected</span>
                    : <span className="text-[var(--fg-2)]">peak {fmtCount(peakViewers)} viewers</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {viewersOff
                    ? <PlaceholderChart label="Viewers" badge="OFF"><StatsDisabledNotice className="h-[84px]" /></PlaceholderChart>
                    : <MiniChart label="Viewers" value={fmtCount(Math.round(series.viewers.at(-1) ?? 0))} data={series.viewers} color="var(--accent)" />}
                  <MiniChart label="Live streams" value={String(app.liveStreamCount)} data={series.streams} color="var(--info)" />
                  <PlaceholderChart label="Stream health" />
                </div>
              </>
            ) : (
              <div className="h-[120px] flex items-center justify-center text-center text-[12px] text-[var(--fg-3)]">
                {error
                  ? 'Trends unavailable'
                  : isLoading
                    ? 'Loading trends…'
                    : 'Collecting metrics… history builds over time and resets on server restart'}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function MiniChart({ label, value, data, color, yFormat = v => String(Math.round(v)), yMax }: {
  label: string
  value: string
  data: number[]
  color: string
  yFormat?: (v: number) => string
  yMax?: number
}) {
  return (
    <Card className="p-4 bg-[var(--card)]">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-[var(--fg-3)]">{label}</span>
        <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[var(--fg)]">{value}</span>
      </div>
      <LineChart height={84} showAxis={false} showGrid={false} padding={{ t: 4, r: 4, b: 4, l: 4 }} yFormat={yFormat} yMax={yMax}
        series={[{ data, color }]} />
    </Card>
  )
}

// A chart slot with nothing to draw: no metric yet (health) or one switched off (viewers, via children).
function PlaceholderChart({ label, badge = 'TODO', children }: { label: string; badge?: string; children?: ReactNode }) {
  return (
    <Card className="p-4 bg-[var(--card)]">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-[var(--fg-3)]">{label}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--fg-3)] px-1.5 py-0.5 rounded bg-[var(--bg-3)] border border-[var(--border)]">{badge}</span>
      </div>
      {children ?? (
        <div className="h-[84px] flex items-center justify-center rounded border border-dashed border-[var(--border)] text-[11px] text-[var(--fg-3)] text-center px-2">
          Not collected yet
        </div>
      )}
    </Card>
  )
}
