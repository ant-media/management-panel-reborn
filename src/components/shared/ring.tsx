import type { ReactNode } from 'react'

export function threshColor(pct: number) {
  return pct > 85 ? 'var(--danger)' : pct > 70 ? 'var(--warn)' : 'var(--ok)'
}

const ease = { transition: 'stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)' }
const clamp = (n: number) => Math.max(0, Math.min(100, n))

type RingProps = {
  pct: number
  size?: number
  thickness?: number
  color?: string
  track?: string
  children?: ReactNode
}

export function Ring({ pct, size = 132, thickness = 11, color, track = 'var(--bg-3)', children }: RingProps) {
  const p = clamp(pct)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const dash = (p / 100) * c
  const stroke = color || threshColor(p)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${c.toFixed(2)}`}
          style={ease}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

type RingArc = { pct: number; color: string }
type DualRingProps = {
  outer: RingArc
  inner: RingArc
  size?: number
  thickness?: number
  // Inner ring stroke; defaults to `thickness`. Set thin (+ small `gap`) for a "hero ring
  // with a glued companion track": a secondary value shown as an arc, not a number.
  innerThickness?: number
  gap?: number
  track?: string
  children?: ReactNode
}

export function DualRing({ outer, inner, size = 120, thickness = 9, innerThickness = thickness, gap = 5, track = 'var(--bg-3)', children }: DualRingProps) {
  const r1 = (size - thickness) / 2
  // Space the inner ring off the outer ring's *inner edge* by `gap` (works for any thickness pair).
  const r2 = r1 - thickness / 2 - gap - innerThickness / 2
  const c1 = 2 * Math.PI * r1
  const c2 = 2 * Math.PI * r2
  const d1 = (clamp(outer.pct) / 100) * c1
  const d2 = (clamp(inner.pct) / 100) * c2
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r1} fill="none" stroke={track} strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r1} fill="none" stroke={outer.color} strokeWidth={thickness}
          strokeLinecap="round" strokeDasharray={`${d1.toFixed(2)} ${c1.toFixed(2)}`} style={ease} />
        <circle cx={size / 2} cy={size / 2} r={r2} fill="none" stroke={track} strokeWidth={innerThickness} />
        <circle cx={size / 2} cy={size / 2} r={r2} fill="none" stroke={inner.color} strokeWidth={innerThickness}
          strokeLinecap="round" strokeDasharray={`${d2.toFixed(2)} ${c2.toFixed(2)}`} style={ease} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
