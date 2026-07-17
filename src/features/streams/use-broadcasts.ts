import { useCallback, useMemo } from 'react'
import { useApi } from '@/lib/api'
import { broadcasts } from '@/lib/api/endpoints'
import type { PageSize } from '@/lib/page-size'
import type { Broadcast, BroadcastType } from './types'

const POLL_MS = 5_000

export type SortKey = 'name' | 'date' | 'status'
export type SortDir = 'asc' | 'desc'

// Backend list query is server-side paginated, search and sort are pushed down too.
export type ListParams = {
  offset: number
  pageSize: PageSize
  search: string
  sortKey: SortKey | null
  sortDir: SortDir
  typeFilter: BroadcastType | null
}

export function useBroadcasts(appName: string | undefined, params: ListParams) {
  const enabled = Boolean(appName)
  const api = useMemo(() => (appName ? broadcasts(appName) : null), [appName])

  // refetchKey strings capture every fetcher-closure dep so changing them
  // triggers an immediate fetch instead of waiting for the next poll tick.
  const listKey = `${appName}|${params.offset}|${params.pageSize}|${params.search}|${params.sortKey ?? ''}|${params.sortDir}|${params.typeFilter ?? ''}`
  const countKey = `${appName}|${params.search}`
  const activeKey = appName ?? ''

  const list = useApi<Broadcast[]>(
    signal => api!.list(params.offset, params.pageSize, {
      search: params.search,
      sortBy: params.sortKey ?? undefined,
      order: params.sortDir,
      type: params.typeFilter ?? undefined,
    }, signal),
    { enabled, pollMs: POLL_MS, refetchKey: listKey },
  )

  const count = useApi<number>(
    signal => api!.count(params.search, signal),
    { enabled, pollMs: POLL_MS, refetchKey: countKey },
  )

  const activeCount = useApi<number>(
    signal => api!.activeLiveStreamCount(signal),
    { enabled, pollMs: POLL_MS, refetchKey: activeKey },
  )

  // Depend on `.refresh` (stable per useApi instance) rather than the wrapper
  // object, which `useApi` re-creates every render. Otherwise this callback
  // changes every render, cascading instability through downstream useCallbacks.
  const listRefresh = list.refresh
  const countRefresh = count.refresh
  const activeRefresh = activeCount.refresh
  const refresh = useCallback(() => {
    listRefresh(); countRefresh(); activeRefresh()
  }, [listRefresh, countRefresh, activeRefresh])

  return {
    broadcasts: list.data,
    total: count.data ?? null,
    activeLive: activeCount.data ?? null,
    error: list.error ?? count.error ?? activeCount.error,
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    refresh,
  }
}
