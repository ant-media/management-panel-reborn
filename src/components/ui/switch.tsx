import { cn } from '@/lib/utils'

type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  id?: string                 // lets an external <label htmlFor> associate (a button is labelable)
  'aria-label'?: string
}

export function Switch({ checked, onChange, id, 'aria-label': ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-label={ariaLabel}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[18px] w-[30px] rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-3)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[14px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}
