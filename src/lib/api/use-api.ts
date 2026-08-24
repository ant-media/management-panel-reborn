import { useCallback, useEffect, useRef, useState } from 'react'

type Fetcher<T> = (signal: AbortSignal) => Promise<T>

type Options = {
  pollMs?: number
  enabled?: boolean
  // Refetch trigger keyed to caller state the fetcher closes over (search, page,
  // path params, …). When this string changes, the next fetch runs immediately
  // instead of waiting for the poll tick. Leave undefined when the fetcher is
  // truly self-contained.
  refetchKey?: string
}

type State<T> = {
  data: T | null
  error: Error | null
  // isLoading: true only when we have nothing to render yet (data === null).
  // isFetching: true whenever a request is in flight, including polls/refresh;
  // lets consumers show a skeleton on first load and a subtle indicator on refresh.
  isLoading: boolean
  isFetching: boolean
}

export function useApi<T>(fetcher: Fetcher<T>, options: Options = {}) {
  const { pollMs, enabled = true, refetchKey } = options

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion(v => v + 1), [])

  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    isLoading: enabled,
    isFetching: false,
  })

  useEffect(() => {
    if (!enabled) return

    let mounted = true
    let inFlight = false
    const ctrl = new AbortController()

    const run = async () => {
      // Skip the tick instead of aborting: a response slower than pollMs would never land.
      if (inFlight) return
      inFlight = true

      setState(s => ({ ...s, isLoading: s.data === null, isFetching: true }))

      try {
        const data = await fetcherRef.current(ctrl.signal)
        if (!mounted || ctrl.signal.aborted) return
        setState({ data, error: null, isLoading: false, isFetching: false })
      } catch (err) {
        if (!mounted || ctrl.signal.aborted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        const error = err instanceof Error ? err : new Error(String(err))
        setState(s => ({ data: s.data, error, isLoading: false, isFetching: false }))
      } finally {
        inFlight = false
      }
    }

    void run()

    const id = pollMs ? window.setInterval(() => void run(), pollMs) : null
    return () => {
      mounted = false
      ctrl.abort()
      if (id !== null) window.clearInterval(id)
    }
  }, [enabled, pollMs, version, refetchKey])

  return { ...state, refresh }
}
