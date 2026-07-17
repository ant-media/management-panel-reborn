import { useCallback, useRef, useState } from 'react'

// Multi-select for tables: click toggles one row, shift-click extends from the
// last toggled row to the clicked one (Finder/Gmail style). Selection is a Set of
// ids and survives paging; callers pass the *currently visible* ids in order so a
// range knows what sits between the anchor and the target.
//
// Generic on purpose: live streams, VoD, and the future cross-app table all share it.
export function useRangeSelection(orderedIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const anchorRef = useRef<string | null>(null)

  const select = useCallback((id: string, range: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      const anchor = anchorRef.current

      if (range && anchor) {
        const a = orderedIds.indexOf(anchor)
        const b = orderedIds.indexOf(id)
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          for (let i = lo; i <= hi; i++) next.add(orderedIds[i])
          return next   // anchor stays put so the range can be re-adjusted
        }
      }

      if (next.has(id)) next.delete(id); else next.add(id)
      anchorRef.current = id
      return next
    })
  }, [orderedIds])

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const allHere = orderedIds.length > 0 && orderedIds.every(id => prev.has(id))
      const next = new Set(prev)
      for (const id of orderedIds) { if (allHere) next.delete(id); else next.add(id) }
      return next
    })
  }, [orderedIds])

  const clear = useCallback(() => { setSelected(new Set()); anchorRef.current = null }, [])

  const remove = useCallback((ids: string[]) => {
    setSelected(prev => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }, [])

  return { selected, select, toggleAll, clear, remove }
}
