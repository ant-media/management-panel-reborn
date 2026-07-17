import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { SearchInput } from '@/components/shared/search-input'
import { Toolbar, ToolbarLeading, ToolbarActions } from '@/components/shared/toolbar'

type Props = {
  search: string
  onSearch: (v: string) => void
  total: number | null
  selectedCount: number
  busy?: boolean
  onUpload: () => void
  onImport: () => void
  onBulkDelete: () => void
}

export function VodsToolbar({
  search, onSearch, total, selectedCount, busy,
  onUpload, onImport, onBulkDelete,
}: Props) {
  return (
    <Toolbar className="px-5 py-2.5 border-b border-[var(--border)]">
      <ToolbarLeading>
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Filter by name or VoD ID…"
          ariaLabel="Filter VoDs"
        />
      </ToolbarLeading>

      <ToolbarActions>
        {selectedCount > 0 ? (
          <>
            <span className="text-[11.5px] text-[var(--fg-3)]">{selectedCount} selected</span>
            <Button variant="dangerOutline" size="sm" onClick={onBulkDelete} disabled={busy}>
              <Icon name="trash" size={12} /> Delete
            </Button>
          </>
        ) : (
          <>
            <span className="text-[11.5px] text-[var(--fg-3)] tabular-nums">{total ?? '-'} VoDs</span>
            <Button variant="outline" size="sm" onClick={onImport} disabled={busy}>
              <Icon name="link" size={12} /> Import folder
            </Button>
            <Button variant="primary" size="sm" onClick={onUpload} disabled={busy}>
              <Icon name="upload" size={12} /> Upload
            </Button>
          </>
        )}
      </ToolbarActions>
    </Toolbar>
  )
}
