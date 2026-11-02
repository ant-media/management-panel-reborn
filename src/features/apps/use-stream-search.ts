import { useEffect, useState } from 'react'
import { useApi } from '@/lib/api'
import { apps, type StreamSearchResult } from '@/lib/api/endpoints'

const DEBOUNCE_MS = 300
export const MIN_SEARCH_LENGTH = 2

// Runs on demand and never polls: each search queries every application the user can access.
export function useStreamSearch(input: string) {
  const typed = input.trim()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(typed), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [typed])

  const { data, error, refresh } = useApi<StreamSearchResult & { query: string }>(
    signal => apps.searchStreams(query, signal).then(result => ({ ...result, query })),
    { enabled: query.length >= MIN_SEARCH_LENGTH, refetchKey: query },
  )

  // useApi keeps the last response, so only trust one that answers what is typed right now.
  const current = query === typed && data?.query === typed
  return {
    results: current ? data.results : null,
    truncated: current && data.truncated,
    error: query === typed ? error : null,
    refresh,
  }
}
