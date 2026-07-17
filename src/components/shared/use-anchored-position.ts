import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react'

// Fixed positioning for popovers portaled to <body> and anchored to a trigger:
// escapes scroll-ancestor overflow clips, clamps to the viewport, flips above the
// trigger when it would overflow below, and tracks the anchor through resize and
// nested-container scroll. Returns null until measured; render the panel with
// `visibility: hidden` until then (one layout pass). Outside-click and Escape
// dismissal stay with the consumer (menu vs combobox semantics differ).

const MARGIN = 6 // keep clear of the viewport edge
const GAP = 4    // trigger <-> panel

type Opts = {
  open: boolean
  triggerRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
  align?: 'left' | 'right'
  // Combobox mode: panel width follows the trigger (align is then anchored left).
  matchWidth?: boolean
}

export type AnchoredPosition = { top: number; left: number; width?: number }

export function useAnchoredPosition({ open, triggerRef, panelRef, align = 'right', matchWidth }: Opts): AnchoredPosition | null {
  const [pos, setPos] = useState<AnchoredPosition | null>(null)

  const place = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return
    const t = trigger.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    const width = matchWidth ? t.width : p.width

    let left = align === 'right' && !matchWidth ? t.right - width : t.left
    left = Math.min(Math.max(MARGIN, left), window.innerWidth - width - MARGIN)

    const below = t.bottom + GAP
    const above = t.top - GAP - p.height
    const flipUp = below + p.height + MARGIN > window.innerHeight && above >= MARGIN
    setPos({ top: flipUp ? above : below, left, ...(matchWidth ? { width: t.width } : null) })
  }, [align, matchWidth, triggerRef, panelRef])

  useLayoutEffect(() => {
    if (open) place()
    else setPos(null)
  }, [open, place])

  useEffect(() => {
    if (!open) return
    // rAF-coalesce reflow: scroll fires per frame, getBoundingClientRect forces layout.
    let raf = 0
    const onReflow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place) }
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true) // capture: track nested scroll containers
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, place])

  return pos
}
