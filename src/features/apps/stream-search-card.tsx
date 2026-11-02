import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Card } from '@/components/ui/card'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { SearchInput } from '@/components/shared/search-input'
import type { StreamSearchItem } from '@/lib/api/endpoints'
import { MIN_SEARCH_LENGTH, useStreamSearch } from './use-stream-search'

// Finds a stream without knowing which application holds it.
export function StreamSearchCard() {
  const [input, setInput] = useState('')
  const { results, truncated, error, refresh } = useStreamSearch(input)
  const typed = input.trim()

  return (
    <Card className="overflow-hidden mb-5">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[var(--fg)] tracking-tight">Find a stream</div>
          <div className="text-[12px] text-[var(--fg-3)] mt-0.5">Search by stream name or ID across your applications</div>
        </div>
        <SearchInput
          className="w-full sm:w-[320px]"
          value={input}
          onChange={setInput}
          placeholder="Stream name or ID…"
          ariaLabel="Search streams"
        />
      </div>

      {typed && (
        <div className="border-t border-[var(--border)]">
          {typed.length < MIN_SEARCH_LENGTH ? (
            <Message>Type at least {MIN_SEARCH_LENGTH} characters.</Message>
          ) : error ? (
            <LoadErrorBanner entity="search results" error={error} onRetry={refresh} className="m-4" />
          ) : results == null ? (
            <Message>Searching…</Message>
          ) : results.length === 0 ? (
            <Message>No streams match "{typed}".</Message>
          ) : (
            <Results items={results} truncated={truncated} />
          )}
        </div>
      )}
    </Card>
  )
}

function Results({ items, truncated }: { items: StreamSearchItem[]; truncated: boolean }) {
  const navigate = useNavigate()
  const appPath = (appName: string) => `/apps/${encodeURIComponent(appName)}`

  return (
    <>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-[var(--fg-3)] border-b border-[var(--border)]">
            <th className="text-left font-medium px-6 py-2.5">Stream name</th>
            <th className="text-left font-medium px-6 py-2.5">Stream ID</th>
            <th className="text-left font-medium px-6 py-2.5">Application</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={`${item.appName}/${item.streamId}`}
              onClick={() => void navigate(appPath(item.appName))}
              className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)] cursor-pointer transition-colors"
            >
              <td className="px-6 py-3 text-[var(--fg)]">{item.name || '-'}</td>
              <td className="px-6 py-3 font-mono text-[12px] text-[var(--fg-2)]">{item.streamId}</td>
              <td className="px-6 py-3">
                <Link
                  to={appPath(item.appName)}
                  onClick={e => e.stopPropagation()}
                  className="font-medium text-[var(--fg)] hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[4px]"
                >
                  {item.appName}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {truncated && (
        <Message>Showing the first {items.length} matches. Refine your search to narrow them down.</Message>
      )}
    </>
  )
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-4 text-[12.5px] text-[var(--fg-3)]">{children}</div>
}
