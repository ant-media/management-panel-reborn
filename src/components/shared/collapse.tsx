import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Smooth height reveal via the grid-rows 0fr↔1fr trick: animates open/close with
// no layout measurement and no fixed max-height guess. Keep the children mounted
// while collapsing so the exit animates too (unmounting them makes close instant).
// Honours prefers-reduced-motion. Closed content is `inert`: clipped children stay
// focusable otherwise, and you tab into an invisible form.
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', className)}
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden min-h-0" inert={!open}>{children}</div>
    </div>
  )
}
