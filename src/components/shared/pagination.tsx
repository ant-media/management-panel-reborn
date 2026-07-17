import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/page-size'

type Props = {
  offset: number
  pageSize: PageSize
  pageItemCount: number
  total: number | null
  onOffset: (offset: number) => void
  onPageSize: (size: PageSize) => void
}

export function Pagination({ offset, pageSize, pageItemCount, total, onOffset, onPageSize }: Props) {
  const start = pageItemCount === 0 ? 0 : offset + 1
  const end = offset + pageItemCount
  const canPrev = offset > 0
  const canNext = total != null ? end < total : pageItemCount === pageSize

  return (
    <div className="px-4 py-2.5 flex items-center justify-between text-[11.5px] text-[var(--fg-3)] border-t border-[var(--border)]">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={e => {
            onPageSize(Number(e.target.value) as PageSize)
            onOffset(0)
          }}
          className="h-6 px-1.5 bg-[var(--bg-2)] rounded text-[var(--fg-2)] outline-none border-0"
        >
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          {start}-{end}{total != null ? <> of {total}</> : null}
        </span>
        <Button variant="ghost" size="iconSm" disabled={!canPrev} onClick={() => onOffset(Math.max(0, offset - pageSize))} aria-label="Previous page">
          <Icon name="chevron-left" size={12} />
        </Button>
        <Button variant="ghost" size="iconSm" disabled={!canNext} onClick={() => onOffset(offset + pageSize)} aria-label="Next page">
          <Icon name="chevron-right" size={12} />
        </Button>
      </div>
    </div>
  )
}
