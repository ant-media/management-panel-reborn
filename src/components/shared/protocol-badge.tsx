const TONES: Record<string, { bg: string; fg: string }> = {
  WebRTC: { bg: 'oklch(0.95 0.04 280 / 0.55)', fg: 'oklch(0.42 0.18 280)' },
  RTMP:   { bg: 'oklch(0.95 0.05 60 / 0.55)',  fg: 'oklch(0.45 0.16 60)'  },
  SRT:    { bg: 'oklch(0.94 0.06 150 / 0.55)', fg: 'oklch(0.40 0.14 150)' },
  HLS:    { bg: 'oklch(0.94 0.05 200 / 0.55)', fg: 'oklch(0.42 0.14 200)' },
  RTSP:   { bg: 'oklch(0.94 0.05 340 / 0.55)', fg: 'oklch(0.45 0.16 340)' },
}

const FALLBACK = { bg: 'var(--bg-2)', fg: 'var(--fg-2)' }

export function ProtocolBadge({ type }: { type: string }) {
  const t = TONES[type] || FALLBACK
  return (
    <span
      className="inline-flex items-center h-4 px-1 rounded-[3px] text-[10px] font-mono font-medium tracking-wider"
      style={{ background: t.bg, color: t.fg }}
    >
      {type}
    </span>
  )
}
