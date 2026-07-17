import { Pill, type PillTone } from '@/components/shared/pill'
import { Icon } from '@/components/ui/icon'
import { Tooltip } from '@/components/shared/tooltip'
import { cn } from '@/lib/utils'
import { resolveStreamStatus, type StreamStatusKind } from './health'
import type { Broadcast } from './types'

// The one stream-status badge, shared by the table and the detail drawer.
// Visual vocabulary: the dot = liveness (red pulse = on-air, grey = warming up,
// none = not running) and the background = severity. Anything with more to say,
// an active stream (its resolution + speed) or an errored one (what failed),
// carries an info dot and a hover popup with the detail.

type Style = { tone: PillTone; label: string; dot: boolean; dotColor?: string; pulse?: boolean }

const STYLE: Record<StreamStatusKind, Style> = {
  healthy:   { tone: 'ok',      label: 'Healthy',   dot: true, dotColor: 'var(--live)', pulse: true },
  unhealthy: { tone: 'warn',    label: 'Unhealthy', dot: true, dotColor: 'var(--live)', pulse: true },
  preparing: { tone: 'ok',      label: 'Preparing', dot: true, dotColor: 'var(--fg-3)', pulse: false },
  offline:   { tone: 'neutral', label: 'Offline',   dot: false },
  error:     { tone: 'err',     label: 'Error',     dot: false },
}

export function StreamStatus({ broadcast }: { broadcast: Broadcast }) {
  const { kind, reasons } = resolveStreamStatus(broadcast)
  const s = STYLE[kind]

  // Active streams carry their resolution + encoding speed in the tooltip,
  // healthy or not. speed > 0 drops the meaningless 0 from WebRTC/just-started.
  const active = kind === 'healthy' || kind === 'unhealthy'
  const meta: [string, string][] = []
  if (active && broadcast.width && broadcast.height) meta.push(['Resolution', `${broadcast.width}×${broadcast.height}`])
  if (active && broadcast.speed != null && broadcast.speed > 0) meta.push(['Speed', `${broadcast.speed.toFixed(2)}x`])

  const hasTip = reasons.length > 0 || meta.length > 0

  const badge = (
    <Pill tone={s.tone} dot={s.dot} dotColor={s.dotColor} pulse={s.pulse} interactive>
      {s.label}
      {hasTip && <Icon name="info" size={11} className="opacity-70" />}
    </Pill>
  )

  if (!hasTip) return badge

  return (
    <Tooltip content={<StatusTip kind={kind} reasons={reasons} meta={meta} />}>
      {badge}
    </Tooltip>
  )
}

function StatusTip({ kind, reasons, meta }: {
  kind: StreamStatusKind
  reasons: string[]
  meta: [string, string][]
}) {
  return (
    <div>
      {reasons.length > 0 && (
        <>
          <div className="text-[11.5px] font-semibold tracking-wide text-[var(--fg)] mb-1.5">
            {kind === 'error' ? 'Stream error' : 'Possible issues'}
          </div>
          <ul className="space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5 leading-snug">
                <span className="text-[var(--fg-3)]">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {meta.length > 0 && (
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', reasons.length > 0 && 'mt-2 pt-2 border-t border-[var(--border)]')}>
          {meta.map(([label, value]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="text-[var(--fg-3)]">{label}</span>
              <span className="font-mono text-[var(--fg-2)]">{value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
