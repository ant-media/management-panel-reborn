import { cn } from '@/lib/utils'

type SortDir = 'asc' | 'desc'

// Sortable `<th>` for server-paginated tables. Generic over the sort-key union so
// each table keeps its own keys type-checked at the call site.
type Props<K extends string> = {
  k: K
  label: string
  align?: 'left' | 'right'
  width?: string
  sortKey: K | null
  sortDir: SortDir
  onSort: (k: K) => void
}

export function SortableTh<K extends string>({ k, label, align = 'left', width, sortKey, sortDir, onSort }: Props<K>) {
  const active = sortKey === k
  return (
    <th className={cn('font-medium px-3 py-2', align === 'right' ? 'text-right' : 'text-left', width)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          'group/sort inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--fg-2)] transition-colors',
          align === 'right' && 'flex-row-reverse',
          active && 'text-[var(--fg)]',
        )}
      >
        {label}
        <SortGlyph active={active} dir={sortDir} />
      </button>
    </th>
  )
}

function SortGlyph({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={cn('inline-flex flex-col -space-y-[3px] transition-opacity', active ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-50')}>
      <svg width="7" height="4" viewBox="0 0 8 5"><path d="M4 0 8 5H0z" fill={active && dir === 'asc' ? 'var(--accent)' : 'var(--fg-3)'} /></svg>
      <svg width="7" height="4" viewBox="0 0 8 5"><path d="M4 5 0 0h8z" fill={active && dir === 'desc' ? 'var(--accent)' : 'var(--fg-3)'} /></svg>
    </span>
  )
}
