import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { SearchInput } from '@/components/shared/search-input'
import { Toolbar, ToolbarLeading, ToolbarActions } from '@/components/shared/toolbar'

// Status filter intentionally omitted: backend pagination is server-side and
// the list endpoint has no status filter, so client-side filtering of one page
// made "Showing 1-N of M" incoherent. Use the sort-by-status column instead.

type Props = {
  search: string
  onSearch: (v: string) => void
  total: number | null
  live: number | null
  selectedCount: number
  busy?: boolean
  onNewStream?: () => void
  onImport?: () => void
  onExport?: () => void
  onBulkDelete?: () => void
}

export function StreamsToolbar({
  search, onSearch,
  total, live, selectedCount, busy,
  onNewStream, onImport, onExport, onBulkDelete,
}: Props) {
  return (
    <Toolbar className="px-5 py-2.5 border-b border-[var(--border)]">
      <ToolbarLeading>
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Filter by name or stream ID…"
          ariaLabel="Filter streams"
        />
      </ToolbarLeading>

      <ToolbarActions>
        {selectedCount > 0 ? (
          <>
            <span className="text-[11.5px] text-[var(--fg-3)]">{selectedCount} selected</span>
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} disabled={busy}>
                <Icon name="download" size={12} /> Export
              </Button>
            )}
            <Button variant="dangerOutline" size="sm" onClick={onBulkDelete} disabled={busy}>
              <Icon name="trash" size={12} /> Delete
            </Button>
          </>
        ) : (
          <>
            <span className="text-[11.5px] text-[var(--fg-3)] tabular-nums">
              {total ?? '-'} streams
              {live != null && live > 0 && <> · <span className="text-[var(--accent)] font-medium">{live} live</span></>}
            </span>
            {onImport && (
              <Button variant="outline" size="sm" onClick={onImport} disabled={busy}>
                <Icon name="upload" size={12} /> Import
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} disabled={busy}>
                <Icon name="download" size={12} /> Export
              </Button>
            )}
            {onNewStream && (
              <Button variant="primary" size="sm" onClick={onNewStream} disabled={busy}>
                <Icon name="plus" size={12} /> New stream
              </Button>
            )}
          </>
        )}
      </ToolbarActions>
    </Toolbar>
  )
}
