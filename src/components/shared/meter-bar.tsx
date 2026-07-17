import { cn } from '@/lib/utils'

// Thin horizontal capacity bar (track + tinted fill). The inline counterpart to Ring:
// used wherever a 0-100 value is shown beside a label/number (GPU util, cluster CPU/mem).
// `tone` is the fill color (e.g. threshColor(pct) or a fixed var); `pct` clamps to 0-100.
export function MeterBar({ pct, tone, className }: { pct: number | null; tone: string; className?: string }) {
  return (
    <div className={cn('h-1.5 bg-[var(--bg-3)] rounded-full overflow-hidden', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%`, background: tone }} />
    </div>
  )
}
