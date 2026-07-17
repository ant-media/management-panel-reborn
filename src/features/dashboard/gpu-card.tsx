import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { MeterBar } from '@/components/shared/meter-bar'
import { Pill } from '@/components/shared/pill'
import { Ring, threshColor } from '@/components/shared/ring'
import { fmtBytes } from '@/lib/format'
import type { GpuView } from './use-dashboard-data'

// Aggregate util ring + per-device breakdown. Backed by the real `gpuUsageInfo` the
// server embeds in /system-resources; there is no temperature field on the wire, so
// the prototype's temp readout is replaced by the real memory-utilisation figure.
export function GpuCard({ gpus }: { gpus: GpuView[] }) {
  const avg = Math.round(gpus.reduce((a, g) => a + g.utilPct, 0) / gpus.length)
  return (
    <Card className="p-6 transition-all hover:border-[var(--border-strong)] hover:shadow-xs">
      <div className="flex items-center gap-2 mb-6">
        <Icon name="gpu" size={16} className="text-[var(--fg-3)]" />
        <span className="text-[14px] font-medium tracking-tight text-[var(--fg)]">GPU</span>
        <Pill tone="neutral">{gpus.length} {gpus.length > 1 ? 'devices' : 'device'}</Pill>
      </div>
      <div className="flex items-start gap-7">
        <Ring pct={avg} size={112} thickness={10}>
          <span className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--fg)] leading-none">{avg}%</span>
          <span className="text-[10px] text-[var(--fg-3)] mt-1 uppercase tracking-wider">avg util</span>
        </Ring>
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {gpus.map(g => (
            <div key={g.index}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[12.5px] font-medium text-[var(--fg)]">GPU {g.index}</span>
                  <span className="text-[11.5px] text-[var(--fg-3)] truncate">{g.name}</span>
                </div>
                <span className="text-[12.5px] font-mono tabular-nums text-[var(--fg-2)] shrink-0">{g.utilPct}%</span>
              </div>
              <MeterBar pct={g.utilPct} tone={threshColor(g.utilPct)} />
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--fg-3)] font-mono tabular-nums">
                <span>{fmtBytes(g.memUsedBytes)} / {fmtBytes(g.memTotalBytes)}</span>
                <span className="text-[var(--border-strong)]">·</span>
                <span>{g.memUtilPct}% mem</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
