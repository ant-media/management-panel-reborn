import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const TONE = {
  ok:      { cls: 'text-[var(--ok)] bg-[var(--ok-bg)]',           dot: 'var(--ok)' },
  warn:    { cls: 'text-[var(--warn)] bg-[var(--warn-bg)]',       dot: 'var(--warn)' },
  err:     { cls: 'text-[var(--danger)] bg-[var(--danger-bg)]',   dot: 'var(--danger)' },
  live:    { cls: 'text-[var(--accent)] bg-[var(--accent-bg)]',   dot: 'var(--accent)' },
  info:    { cls: 'text-[var(--info)] bg-[var(--info-bg)]',       dot: 'var(--info)' },
  neutral: { cls: 'text-[var(--fg-3)] bg-[var(--bg-2)]',          dot: 'var(--fg-3)' },
} as const

export type PillTone = keyof typeof TONE

type Props = {
  tone?: PillTone
  dot?: boolean
  // Override the dot's colour independently of the tone (e.g. a red "on-air"
  // dot on a green/amber health badge). Defaults to the tone's own colour.
  dotColor?: string
  // Override the pulse. Defaults to on for live/err tones; pass false/true to
  // force it (e.g. a static dot on a non-live state).
  pulse?: boolean
  interactive?: boolean
  children: ReactNode
}

export function Pill({ tone = 'neutral', dot, dotColor, pulse, interactive, children }: Props) {
  const t = TONE[tone]
  const dotCol = dotColor ?? t.dot
  const doPulse = pulse ?? (tone === 'live' || tone === 'err')
  return (
    <span className={cn(
      'inline-flex items-center gap-1 h-5 px-1.5 rounded-[4px] text-[10.5px] font-medium',
      t.cls,
      // Hover = a subtle shade shift only (no scale/move), to match the
      // background-highlight hover on the table's value cells.
      interactive && 'transition-all duration-150 hover:brightness-[0.94] cursor-default',
    )}>
      {dot && (
        <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: dotCol }}>
          {doPulse && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: dotCol, opacity: 0.5 }} />}
        </span>
      )}
      {children}
    </span>
  )
}
