import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// Generic hover/focus tooltip. REUSE THIS anywhere you need a revealed bubble
// (help text, status diagnostics, truncated-value previews): do NOT reach for
// native `title=` or hand-roll another one.
//
// It portals to <body> and positions `fixed` against the trigger, so it escapes
// the overflow-clip of any scroll ancestor (tables, drawers) and flips/clamps to
// stay on-screen (the same approach as ActionMenu). `content` is treated as
// non-interactive (the bubble itself ignores the pointer and closes when the
// trigger is left/blurred); if you ever need a hover-card with clickable
// content, extend the open/close handling here rather than forking this.
//
// When `content` is falsy the trigger renders bare (no wrapper, no listeners),
// so callers can gate the tooltip with a simple conditional value.

const MARGIN = 6 // viewport edge clearance
const GAP = 6    // trigger ↔ tooltip

type Props = {
  content: ReactNode
  children: ReactNode
  placement?: 'top' | 'bottom' // preferred side; auto-flips when it won't fit
  delay?: number               // ms before showing, debounces fly-over hovers
  className?: string           // extra classes on the bubble (e.g. width)
  // The wrapper is focusable so keyboard users can reach a tooltip on inert content (an icon, a
  // disabled button). Pass false when the child is itself focusable and enabled: focus bubbles up
  // to us anyway, so the extra tab stop would just be a second stop on every row of a table.
  focusable?: boolean
}

export function Tooltip({ content, children, placement = 'top', delay = 120, className, focusable = true }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tipId = useId()

  const show = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), delay)
  }, [delay])
  const hide = useCallback(() => {
    clearTimeout(timer.current)
    setOpen(false)
  }, [])

  const place = useCallback(() => {
    const trigger = triggerRef.current
    const tip = tipRef.current
    if (!trigger || !tip) return
    const t = trigger.getBoundingClientRect()
    const m = tip.getBoundingClientRect()

    let left = t.left + t.width / 2 - m.width / 2
    left = Math.min(Math.max(MARGIN, left), window.innerWidth - m.width - MARGIN)

    const above = t.top - GAP - m.height
    const below = t.bottom + GAP
    const fitsAbove = above >= MARGIN
    const fitsBelow = below + m.height + MARGIN <= window.innerHeight
    const top = placement === 'top'
      ? (fitsAbove || !fitsBelow ? above : below)
      : (fitsBelow || !fitsAbove ? below : above)
    setPos({ top, left })
  }, [placement])

  // Measure-then-place before paint. No reset on close: the bubble unmounts when
  // closed, and this re-measures on reopen before the next paint, so a stale
  // position never flashes.
  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    // rAF-coalesce reflow: scroll fires per frame, getBoundingClientRect forces layout.
    let raf = 0
    const onReflow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place) }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true) // capture: track nested scroll containers
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, place, hide])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!content) return <>{children}</>

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={open ? tipId : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && createPortal(
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? 'visible' : 'hidden', // hide until measured (1 layout pass)
          }}
          className={cn(
            // Stronger border + heavier shadow so it reads as elevated in BOTH
            // themes: in dark mode the border (not the near-invisible shadow)
            // is what separates it from same-coloured cards beneath.
            'z-50 max-w-[280px] px-3 py-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--border-strong)] shadow-2xl',
            'text-[11.5px] text-[var(--fg-2)] pointer-events-none',
            className,
          )}
        >
          {content}
        </div>,
        document.body,
      )}
    </span>
  )
}
