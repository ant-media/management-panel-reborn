import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Responsive list/page toolbar. Put controls in exactly two regions: a leading
// region (search + filters) and a trailing actions region. On a wide bar they sit
// on one row, pushed apart; when width runs out each region drops to its OWN row,
// left-aligned, instead of a single control orphan-wrapping to the far right.
//
// Why this shape: `justify-between` spreads the two regions on a shared line, and
// because a wrapped line holding a single flex item falls back to flex-start, the
// regions stack cleanly when they wrap. Both regions `flex-wrap` + `min-w-0` so a
// crowded region wraps its own buttons rather than overflowing the bar.
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}>{children}</div>
}

export function ToolbarLeading({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2 min-w-0', className)}>{children}</div>
}

export function ToolbarActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2 min-w-0', className)}>{children}</div>
}
