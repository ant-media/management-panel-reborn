import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { LineChart, type LineSeries } from '@/components/shared/line-chart'

// The 5s poll keeps ~60 samples: honestly "last 5 minutes", not the prototype's 24h.
const TAIL_LABEL = 'last 5 minutes'

export type HistoryPanelProps = {
  icon: IconName
  title: string
  hint: string
  current: string
  series: LineSeries[]
  yMax?: number
  yFormat?: (v: number, seriesIdx?: number) => string
  legend?: { label: string; color: string }[]
  onClose: () => void
}

// Shared detail panel for the Tier-2 meters: capacity rings pass one % series, the
// bandwidth ring passes two (out/in) with a legend and a raw-number yFormat.
export function HistoryPanel({ icon, title, hint, current, series, yMax, yFormat, legend, onClose }: HistoryPanelProps) {
  const ready = series.some(s => s.data.length >= 2)
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--bg-2)] flex items-center justify-center shrink-0">
            <Icon name={icon} size={15} className="text-[var(--fg-2)]" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-[var(--fg)] tracking-tight">{title} · {TAIL_LABEL}</div>
            <div className="text-[12px] text-[var(--fg-3)] font-mono">{hint}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {legend && (
            <div className="hidden sm:flex items-center gap-3 text-[12px]">
              {legend.map(l => (
                <span key={l.label} className="flex items-center gap-1.5 text-[var(--fg-2)]">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />{l.label}
                </span>
              ))}
            </div>
          )}
          <div className="text-right">
            <div className="text-[20px] font-semibold tabular-nums tracking-tight text-[var(--fg)] leading-none">{current}</div>
            <div className="text-[10.5px] text-[var(--fg-3)] uppercase tracking-wider mt-1">current</div>
          </div>
          <Button variant="ghost" size="iconSm" onClick={onClose}><Icon name="x" size={14} /></Button>
        </div>
      </div>
      {ready ? (
        <LineChart height={170} yMax={yMax} yFormat={yFormat} series={series} />
      ) : (
        <div className="h-[170px] flex items-center justify-center text-[12.5px] text-[var(--fg-3)]">Collecting samples…</div>
      )}
    </Card>
  )
}
