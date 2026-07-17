import { cn } from '@/lib/utils'

type Props = {
  checked: boolean
  // The originating click is forwarded so callers can read modifiers (e.g. shift
  // for range-select). Callers that only take `next` simply ignore it.
  onChange: (next: boolean, event: React.MouseEvent) => void
}

export function Checkbox({ checked, onChange }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={e => onChange(!checked, e)}
      className={cn(
        'w-[15px] h-[15px] rounded-[3px] border inline-flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        checked
          ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
          : 'border-[var(--border-strong)] bg-[var(--card)] hover:border-[var(--fg-3)]',
      )}
    >
      {checked && (
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 8 3.5 3.5L13 5"/>
        </svg>
      )}
    </button>
  )
}
