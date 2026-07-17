import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { errorMessage, type Result } from '@/lib/api'
import { useApi } from '@/lib/api/use-api'
import { apps } from '@/lib/api/endpoints'

const APPS_POLL_MS = 15_000

export type ApplicationInfo = {
  name: string
  liveStreamCount: number
  vodCount: number
  storage: number
}

// Canonical Result lives in @/lib/api; re-exported here for the apps-feature callers.
export type { Result }

export const APP_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/

type Context = {
  apps: ApplicationInfo[] | null
  error: Error | null
  isLoading: boolean
  isFetching: boolean
  refresh: () => void
  create: (name: string, warFile?: File | null) => Promise<Result>
  remove: (name: string, deleteDB: boolean) => Promise<Result>
}

const ApplicationsContext = createContext<Context | null>(null)

export function ApplicationsProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, isFetching, refresh } = useApi<ApplicationInfo[]>(
    signal => apps.info(signal),
    { pollMs: APPS_POLL_MS },
  )

  // Optimistic overlay: drop locally-deleted names until the next poll confirms.
  // Without this the row reappears for up to APPS_POLL_MS after delete returns success.
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())

  // Once the server stops returning a name, the overlay is no longer load-bearing, prune it
  // so the Set doesn't grow for the session lifetime.
  useEffect(() => {
    if (!data) return
    setPendingDeletes(prev => {
      if (prev.size === 0) return prev
      const names = new Set(data.map(a => a.name))
      const next = new Set<string>()
      let changed = false
      for (const n of prev) {
        if (names.has(n)) next.add(n)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [data])

  const visibleApps = useMemo(() => {
    if (!data) return null
    if (pendingDeletes.size === 0) return data
    return data.filter(a => !pendingDeletes.has(a.name))
  }, [data, pendingDeletes])

  const create = useCallback(async (name: string, warFile?: File | null): Promise<Result> => {
    try {
      const res = await apps.create(name, warFile)
      if (res?.success) refresh()
      return res ?? { success: false, message: 'Empty response' }
    } catch (err) {
      return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
    }
  }, [refresh])

  const remove = useCallback(async (name: string, deleteDB: boolean): Promise<Result> => {
    try {
      const res = await apps.remove(name, deleteDB)
      if (res?.success) {
        setPendingDeletes(s => { const n = new Set(s); n.add(name); return n })
        refresh()
      }
      return res ?? { success: false, message: 'Empty response' }
    } catch (err) {
      return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
    }
  }, [refresh])

  const value = useMemo<Context>(() => ({
    apps: visibleApps,
    error,
    isLoading,
    isFetching,
    refresh,
    create,
    remove,
  }), [visibleApps, error, isLoading, isFetching, refresh, create, remove])

  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>
}

export function useApplications(): Context {
  const ctx = useContext(ApplicationsContext)
  if (!ctx) throw new Error('useApplications must be used inside <ApplicationsProvider>')
  return ctx
}
