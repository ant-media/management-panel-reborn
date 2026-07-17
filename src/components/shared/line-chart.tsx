import { useLayoutEffect, useRef, useState } from 'react'

export type LineSeries = {
  data: number[]
  color: string
  width?: number
  fill?: boolean
}

type Props = {
  series: LineSeries[]
  height?: number
  yMax?: number
  yFormat?: (v: number, seriesIdx?: number) => string
  showAxis?: boolean
  showGrid?: boolean
  padding?: { t: number; r: number; b: number; l: number }
}

const Y_TICKS = 4
const DEFAULT_PADDING = { t: 8, r: 8, b: 16, l: 32 }

export function LineChart({
  series,
  height = 120,
  yMax,
  yFormat = (v) => v.toFixed(0),
  showAxis = true,
  showGrid = true,
  padding = DEFAULT_PADDING,
}: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Draw in a 1:1 coordinate system that tracks the rendered pixel width, so text, the
  // tooltip and markers are never distorted (the old fixed viewBox + preserveAspectRatio="none"
  // stretched everything non-uniformly on the X axis). Responsive on any width via ResizeObserver.
  const [measuredW, setMeasuredW] = useState(0)
  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setMeasuredW(w)
    }
    measure() // sync, before first paint: avoids a distorted first frame
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W = measuredW || 600

  const innerW = Math.max(0, W - padding.l - padding.r)
  const innerH = height - padding.t - padding.b
  const max = yMax ?? Math.max(...series.flatMap(s => s.data), 0.1)
  const xCount = Math.max(...series.map(s => s.data.length))
  const xStep = xCount > 1 ? innerW / (xCount - 1) : 0

  const xAt = (i: number) => padding.l + i * xStep
  const yAt = (v: number) => padding.t + innerH - (v / max) * innerH

  const pathFor = (s: LineSeries) =>
    s.data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')

  const areaFor = (s: LineSeries) =>
    `${pathFor(s)} L${xAt(s.data.length - 1).toFixed(1)},${(padding.t + innerH).toFixed(1)} L${padding.l.toFixed(1)},${(padding.t + innerH).toFixed(1)} Z`

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || xStep === 0) return
    const xPx = e.clientX - rect.left
    const idx = Math.round((xPx - padding.l) / xStep)
    setHover(idx < 0 || idx >= xCount ? null : idx)
  }

  const TOOLTIP_W = 92
  // Keep the tooltip fully inside the chart at any width (incl. very narrow screens).
  const tooltipX = hover === null ? 0 : Math.max(2, Math.min(W - TOOLTIP_W - 2, xAt(hover) + 8))

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      className="block overflow-visible"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {showGrid && Array.from({ length: Y_TICKS + 1 }).map((_, i) => {
        const v = max - (max / Y_TICKS) * i
        const y = padding.t + (innerH / Y_TICKS) * i
        return (
          <g key={i}>
            <line x1={padding.l} x2={padding.l + innerW} y1={y} y2={y} stroke="var(--border)" strokeDasharray={i === Y_TICKS ? '0' : '2,3'} />
            {showAxis && (
              <text x={padding.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--fg-3)" fontFamily="var(--font-mono)">
                {yFormat(v)}
              </text>
            )}
          </g>
        )
      })}

      {series.map((s, i) => s.fill !== false && (
        <path key={`a${i}`} d={areaFor(s)} fill={s.color} opacity="0.10" />
      ))}
      {series.map((s, i) => (
        <path key={`l${i}`} d={pathFor(s)} fill="none" stroke={s.color} strokeWidth={s.width || 1.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {hover !== null && (
        <>
          <line
            x1={xAt(hover)} x2={xAt(hover)}
            y1={padding.t} y2={padding.t + innerH}
            stroke="var(--border-strong)" strokeDasharray="2,2"
          />
          {series.map((s, i) => {
            const v = s.data[hover]
            if (v == null) return null
            return <circle key={i} cx={xAt(hover)} cy={yAt(v)} r="3" fill={s.color} stroke="var(--card)" strokeWidth="1.5" />
          })}
          <g transform={`translate(${tooltipX.toFixed(1)}, ${padding.t + 4})`}>
            <rect width={TOOLTIP_W} height={18 + series.length * 14} fill="var(--card)" stroke="var(--border-strong)" rx="4" />
            {series.map((s, i) => (
              <g key={i} transform={`translate(6, ${14 + i * 14})`}>
                <rect x="0" y="-7" width="6" height="6" fill={s.color} rx="1" />
                <text x="10" y="-1" fontSize="9.5" fill="var(--fg-2)" fontFamily="var(--font-mono)">{yFormat(s.data[hover], i)}</text>
              </g>
            ))}
          </g>
        </>
      )}
    </svg>
  )
}
