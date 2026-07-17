// Reachability pub/sub (mirrors auth-bridge): the transport emits per request outcome, the
// ConnectionProvider consumes.
type Listener = (reachable: boolean) => void

const listeners = new Set<Listener>()

export function onReachability(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function emitReachability(reachable: boolean) {
  for (const fn of listeners) fn(reachable)
}
