import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onReachability } from '@/lib/api'
import { emitAuthFailure } from '@/lib/api/auth-bridge'
import { checkAuthenticated } from '@/lib/auth/api'

const RETRY_INTERVAL = 10 // seconds between reconnect probes

export type ConnectionStatus = 'connected' | 'disconnected'

type Context = {
  status: ConnectionStatus
  nextRetryIn: number
  isProbing: boolean
  lastConnectedAt: number | null
  retryNow: () => void
}

const ConnectionContext = createContext<Context | null>(null)

// Owns connected/disconnected for the whole shell. Every request outcome flips it through the
// reachability bridge; while down, a probe loop watches for recovery. `children` pass through
// untouched, so the per-second countdown re-renders only its consumers (pill + banner).
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connected')
  const [nextRetryIn, setNextRetryIn] = useState(RETRY_INTERVAL)
  const [isProbing, setIsProbing] = useState(false)
  const [lastConnectedAt, setLastConnectedAt] = useState<number | null>(null)
  const statusRef = useRef<ConnectionStatus>('connected')
  const countdownRef = useRef(RETRY_INTERVAL)
  const probingRef = useRef(false)

  // A reachable probe reconnects via the bridge below; a reachable-but-unauthenticated one
  // means the session died, so log out. A network throw leaves us down for the next tick. The
  // ref guard collapses overlapping probes (a slow request meeting the tick or a manual retry).
  const probe = useCallback(async () => {
    if (probingRef.current) return
    probingRef.current = true
    setIsProbing(true)
    try {
      if (!(await checkAuthenticated())) emitAuthFailure()
    } catch { /* still unreachable */ }
    finally { probingRef.current = false; setIsProbing(false) }
  }, [])

  const retryNow = useCallback(() => {
    countdownRef.current = RETRY_INTERVAL
    setNextRetryIn(RETRY_INTERVAL)
    void probe()
  }, [probe])

  // Single source of truth for the state: the transport reports reachability per request; only
  // transitions touch state (steady traffic while connected is a no-op).
  useEffect(() => onReachability(reachable => {
    if (reachable && statusRef.current === 'disconnected') {
      statusRef.current = 'connected'
      setStatus('connected')
    } else if (!reachable && statusRef.current === 'connected') {
      statusRef.current = 'disconnected'
      countdownRef.current = RETRY_INTERVAL
      setLastConnectedAt(Date.now())
      setNextRetryIn(RETRY_INTERVAL)
      setStatus('disconnected')
    }
  }), [])

  // Reconnect loop: only while down. Ticks the visible countdown, probes when it hits zero.
  useEffect(() => {
    if (status !== 'disconnected') return
    const id = window.setInterval(() => {
      countdownRef.current -= 1
      if (countdownRef.current <= 0) {
        countdownRef.current = RETRY_INTERVAL
        void probe()
      }
      setNextRetryIn(countdownRef.current)
    }, 1000)
    return () => window.clearInterval(id)
  }, [status, probe])

  const value = useMemo<Context>(
    () => ({ status, nextRetryIn, isProbing, lastConnectedAt, retryNow }),
    [status, nextRetryIn, isProbing, lastConnectedAt, retryNow],
  )

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}

export function useConnectionStatus(): Context {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnectionStatus must be used inside <ConnectionProvider>')
  return ctx
}
