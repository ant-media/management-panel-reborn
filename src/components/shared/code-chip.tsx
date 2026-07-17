import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Inline monospace chip for identifiers / short code fragments. Deliberately uses
// --bg-3 + --border-strong rather than --bg-2: on a card/panel (which is --card),
// --bg-2 collapses into the background in dark mode and the chip reads as plain
// text. --bg-3 keeps a visible step against both page and card in light AND dark.
export function CodeChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        'inline-block font-mono text-[12px] text-[var(--fg)] bg-[var(--bg-3)] border border-[var(--border-strong)] rounded px-1.5 py-0.5',
        className,
      )}
    >
      {children}
    </code>
  )
}
