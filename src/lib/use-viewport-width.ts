import { useEffect, useState } from 'react'

/**
 * Layout viewport width in CSS pixels.
 *
 * Stable during in-page animations, only a window resize or browser zoom changes
 * it (both fire `resize`), so it's the right basis for layout decisions that must
 * not lag an animating sidebar/panel. Measuring an element that itself animates
 * would make thresholded decisions flicker mid-transition.
 */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setWidth(window.innerWidth)
    onResize() // reconcile any resize between first render and effect
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return width
}
