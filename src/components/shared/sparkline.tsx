type Props = {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  full?: boolean
  strokeWidth?: number
  opacity?: number
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  stroke = 'var(--fg-3)',
  fill,
  full = false,
  strokeWidth = 1.25,
  opacity = 1,
}: Props) {
  if (!data.length) return null
  const max = Math.max(...data, 0.1)
  const min = Math.min(...data, 0)
  const range = Math.max(max - min, 0.1)
  const xStep = width / (data.length - 1)
  const pts = data.map((v, i) => [i * xStep, height - ((v - min) / range) * (height - 2) - 1] as const)
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${path} L${width},${height} L0,${height} Z`
  return (
    <svg
      width={full ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={full ? 'none' : 'xMidYMid meet'}
      className="block"
      style={{ opacity }}
    >
      {fill && <path d={area} fill={fill} opacity="0.4" />}
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
