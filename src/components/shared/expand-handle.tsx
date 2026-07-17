import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

// Unified "click to expand" affordance for every card whose history opens below
// it (dashboard stat + meter cards, stream-drawer metric tiles). A hairline footer
// with a centered chevron that rotates down→up when open, pointing at where the
// panel appears. The parent card must carry `group` so hovering it darkens the
// line + chevron.
//   className   supplies the negative-margin inset so the line bleeds to the card's
//               edges past its padding (e.g. "-mx-4 -mb-4" for a p-4 card).
//   line=false  drops the hairline (a bare always-visible chevron, e.g. overlaid on a tile).
//   growOnHover scales the chevron up ~15% on card hover: the affordance for bare
//               chevrons (no band to darken). size tunes the glyph (default 13).
export function ExpandHandle({ open, line = true, size = 13, growOnHover, className }: {
  open: boolean
  line?: boolean
  size?: number
  growOnHover?: boolean
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex items-center justify-center h-4 transition-colors',
        line && 'border-t border-[var(--border)] bg-[var(--expand-bg)] group-hover:bg-[var(--expand-bg-hover)] group-hover:border-[var(--border-strong)]',
        // Expanded reads like hover: keep the darker band + border while open.
        line && open && 'bg-[var(--expand-bg-hover)] border-[var(--border-strong)]',
        className,
      )}
    >
      <Icon
        name="chevron-down"
        size={size}
        strokeWidth={2.5}
        className={cn(
          'text-[var(--fg-3)] transition-all duration-200 group-hover:text-[var(--fg)]',
          open && 'rotate-180 text-[var(--fg-2)]',
          growOnHover && 'group-hover:scale-[1.15]',
        )}
      />
    </div>
  )
}
