import { useEffect, useEffectEvent } from 'react'

// Escape closes the topmost open layer only (menu over modal over drawer). Layers stack in
// the order they open and one shared listener calls the top one, so a press never reaches
// what is underneath. A layer that ignores the key (a busy modal) still holds it.
const layers: (() => void)[] = []

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') layers.at(-1)?.()
}

export function useEscapeKey(active: boolean, onEscape: () => void) {
  // Effect event: a new onEscape each render must not re-register and lose the layer's place.
  const handle = useEffectEvent(onEscape)
  useEffect(() => {
    if (!active) return
    if (layers.length === 0) document.addEventListener('keydown', onKeyDown)
    layers.push(handle)
    return () => {
      layers.splice(layers.lastIndexOf(handle), 1)
      if (layers.length === 0) document.removeEventListener('keydown', onKeyDown)
    }
  }, [active])
}
