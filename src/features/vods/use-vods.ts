import { useCallback, useMemo } from 'react'
import { useApi } from '@/lib/api'
import { vods } from '@/lib/api/endpoints'
import type { PageSize } from '@/lib/page-size'
import type { VoD } from './types'

// VoDs change far slower than live streams (a recording lands when a stream ends,
// an upload finishes processing), so a lazy poll keeps the list fresh enough.
const POLL_MS = 10_000

export type VodSortKey = 'name' | 'date'
export type SortDir = 'asc' | 'desc'

export type VodListParams = {
  offset: number
  pageSize: PageSize
  search: string
  sortKey: VodSortKey | null
  sortDir: SortDir
}

export function useVods(appName: string | undefined, params: VodListParams) {
  const enabled = Boolean(appName)
  const api = useMemo(() => (appName ? vods(appName) : null), [appName])

  // refetchKey captures every fetcher dep so a query change fetches immediately
  // instead of waiting for the next poll tick.
  const listKey = `${appName}|${params.offset}|${params.pageSize}|${params.search}|${params.sortKey ?? ''}|${params.sortDir}`
  const countKey = `${appName}|${params.search}`

  const list = useApi<VoD[]>(
    signal => api!.list(params.offset, params.pageSize, {
      search: params.search,
      sortBy: params.sortKey ?? undefined,
      order: params.sortDir,
    }, signal),
    { enabled, pollMs: POLL_MS, refetchKey: listKey },
  )

  const count = useApi<number>(
    signal => api!.count(params.search, signal),
    { enabled, pollMs: POLL_MS, refetchKey: countKey },
  )

  // Depend on the stable `.refresh` fns, not the wrapper objects useApi rebuilds
  // each render, so this callback stays referentially stable for downstream memo.
  const listRefresh = list.refresh
  const countRefresh = count.refresh
  const refresh = useCallback(() => { listRefresh(); countRefresh() }, [listRefresh, countRefresh])

  return {
    vods: list.data,
    total: count.data ?? null,
    error: list.error ?? count.error,
    isLoading: list.isLoading,
    refresh,
  }
}

const SUGGEST_MAX = 5

// As-you-type suggestions for the playlist item input. Transient surface: no poll,
// one fetch per (already debounced) query change; useApi aborts the in-flight
// request when the key changes. Newest-first is the best relevance proxy the
// server offers; `search` itself matches vodId and vodName (and more) substrings.
export function useVodSuggestions(appName: string | undefined, query: string, open: boolean) {
  const q = query.trim()
  const enabled = open && q.length > 0 && Boolean(appName)
  const list = useApi<VoD[]>(
    signal => vods(appName!).list(0, SUGGEST_MAX, { search: q, sortBy: 'date', order: 'desc' }, signal),
    { enabled, refetchKey: `${appName}|${q}` },
  )
  return { vods: list.data, isLoading: list.isLoading, error: list.error }
}
