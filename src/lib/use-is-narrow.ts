import { useEffect, useState } from 'react'

// Streams master-detail: overlay below this width, inline dock above.
// 640 leaves room for the 580px panel plus a usable table column.
export const SPLIT_BREAKPOINT = 640

export function useIsNarrow(maxWidth = SPLIT_BREAKPOINT): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia === 'function' && matchMedia(`(max-width:${maxWidth}px)`).matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(`(max-width:${maxWidth}px)`)
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [maxWidth])
  return narrow
}
