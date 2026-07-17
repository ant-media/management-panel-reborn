type Listener = () => void

const listeners = new Set<Listener>()

export function onAuthFailure(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function emitAuthFailure() {
  for (const fn of listeners) fn()
}
