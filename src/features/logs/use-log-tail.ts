import { useCallback, useEffect, useRef, useState } from 'react'
import type { LogSource } from './log-sources'
import { parseLogback, type LogEntry } from './parse'

// Periodic tail + client-side reconciliation. Each tick re-fetches the last `charSize`
// bytes; we change-gate on logFileSize, parse, and append only entries we don't already
// hold (matched by stable id), so the DOM grows append-only and never flickers.

const TAIL_OFFSET = -1

type Options = { charSize: number; pollMs: number; cap: number }

type State = {
  entries: LogEntry[]
  fileSize: number
  isFetching: boolean
  error: Error | null
}

const EMPTY: State = { entries: [], fileSize: 0, isFetching: false, error: null }

export function useLogTail(source: LogSource, { charSize, pollMs, cap }: Options) {
  const [state, setState] = useState<State>(EMPTY)

  const bufRef = useRef<LogEntry[]>([])
  const idsRef = useRef<Set<string>>(new Set())
  const lastSizeRef = useRef<number | null>(null)
  const capRef = useRef(cap)
  capRef.current = cap

  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion(v => v + 1), [])

  // Fresh stream ONLY when the source switches; must not run on pollMs changes
  // (pause/resume, interval) or it would wipe the buffer and snap the view to bottom.
  useEffect(() => {
    bufRef.current = []
    idsRef.current = new Set()
    lastSizeRef.current = null
    setState(EMPTY)
  }, [source])

  // Poll + reconcile into the existing buffer. Re-subscribes on pollMs/refresh without resetting.
  useEffect(() => {
    let mounted = true
    let ctrl: AbortController | null = null
    let inFlight = false

    const run = async () => {
      if (inFlight) return // a slow fetch outran the interval, skip this tick
      inFlight = true
      ctrl?.abort()
      const c = new AbortController()
      ctrl = c
      setState(s => ({ ...s, isFetching: true }))
      try {
        const slice = await source.fetchSlice(TAIL_OFFSET, charSize, c.signal)
        if (!mounted || c.signal.aborted) return

        const grew = lastSizeRef.current === null || slice.logFileSize !== lastSizeRef.current
        lastSizeRef.current = slice.logFileSize
        if (!grew) {
          setState(s => ({ ...s, isFetching: false, error: null, fileSize: slice.logFileSize }))
          return
        }

        const trimHead = slice.logFileSize > slice.logContentSize
        const parsed = parseLogback(slice.logContent, trimHead)
        const ids = idsRef.current
        const fresh = parsed.filter(e => !ids.has(e.id))
        if (fresh.length === 0) {
          setState(s => ({ ...s, isFetching: false, error: null, fileSize: slice.logFileSize }))
          return
        }

        for (const e of fresh) ids.add(e.id)
        let buf = bufRef.current.concat(fresh)
        const max = capRef.current
        if (buf.length > max) {
          for (const e of buf.slice(0, buf.length - max)) ids.delete(e.id)
          buf = buf.slice(buf.length - max)
        }
        bufRef.current = buf
        setState({ entries: buf, fileSize: slice.logFileSize, isFetching: false, error: null })
      } catch (err) {
        if (!mounted || c.signal.aborted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState(s => ({ ...s, isFetching: false, error: err instanceof Error ? err : new Error(String(err)) }))
      } finally {
        inFlight = false
      }
    }

    void run()
    const id = pollMs > 0 ? window.setInterval(() => void run(), pollMs) : null
    return () => {
      mounted = false
      ctrl?.abort()
      if (id !== null) window.clearInterval(id)
    }
  }, [source, charSize, pollMs, version])

  // Lowering the cap trims the held buffer without waiting for the next append.
  useEffect(() => {
    if (bufRef.current.length <= cap) return
    const buf = bufRef.current
    for (const e of buf.slice(0, buf.length - cap)) idsRef.current.delete(e.id)
    bufRef.current = buf.slice(buf.length - cap)
    setState(s => ({ ...s, entries: bufRef.current }))
  }, [cap])

  return { ...state, refresh }
}
