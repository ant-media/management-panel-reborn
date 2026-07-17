import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/clipboard'

type Props = {
  value: string
  className?: string
  // When truthy: render the value next to the copy button (default). When false:
  // render only the copy button: useful in dense cells where the value is shown elsewhere.
  showValue?: boolean
  // `sm` = denser button for tight table cells; `md` (default) elsewhere.
  size?: 'sm' | 'md'
}

export function CopyChip({ value, className, showValue = true, size = 'md' }: Props) {
  const [done, setDone] = useState(false)
  // Auto-clear the "Copied" tick. Effect-based so unmount clears the timer.
  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(() => setDone(false), 1200)
    return () => window.clearTimeout(id)
  }, [done])

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (copyToClipboard(value)) setDone(true)
  }
  const sm = size === 'sm'
  return (
    <span className={cn('inline-flex items-center gap-1 min-w-0', className)}>
      {showValue && (
        // min-w-0 lets the value shrink and ellipsize (CSS truncation) when the chip
        // is width-bounded by its container; the full value stays in the title + copy.
        <span title={value} className="text-[10.5px] text-[var(--fg-3)] font-mono truncate min-w-0">{value}</span>
      )}
      <button
        type="button"
        onClick={onClick}
        title={done ? 'Copied' : `Copy: ${value}`}
        aria-label={`Copy ${value}`}
        className={cn(
          'inline-flex items-center justify-center rounded text-[var(--fg-3)] hover:text-[var(--fg)] hover:bg-[var(--bg-3)] transition-colors shrink-0',
          sm ? 'w-3.5 h-3.5' : 'w-4 h-4',
        )}
      >
        <Icon name={done ? 'check' : 'copy'} size={sm ? 9 : 10} />
      </button>
    </span>
  )
}
