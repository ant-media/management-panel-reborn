import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

// List filter box. `md` = toolbar height, `sm` = page-header height. Width defaults
// to 260px (md) / fluid (sm) but is overridable via `className` (e.g. `flex-1 max-w-…`)
// - the input always fills its wrapper, so a fluid wrapper gives a fluid search.
export function SearchInput({
  value, onChange, placeholder, ariaLabel, size = 'md', className, autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
  // Marks the input for Modal's [data-autofocus] focus-on-open.
  autoFocus?: boolean
}) {
  const sm = size === 'sm'
  return (
    <div className={cn('relative', sm ? 'w-full' : 'w-[260px]', className)}>
      <Icon name="search" size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)]" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-autofocus={autoFocus ? '' : undefined}
        className={cn(
          'w-full pl-7 pr-2 bg-[var(--bg-2)] outline-none rounded-[6px] text-[var(--fg)] placeholder:text-[var(--fg-3)] focus:border-[var(--border-strong)]',
          sm
            ? 'h-7 text-[12px] border border-[var(--border)] rounded-[5px]'
            : 'h-8 text-[12.5px] border border-transparent',
        )}
      />
    </div>
  )
}
