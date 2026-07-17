import { useState } from 'react'
import { Icon } from '@/components/ui/icon'

// Hover/focus info tooltip. Sparse use: only for genuinely non-obvious settings/labels.
// Keyboard-accessible: the trigger is focusable, the tip shows on focus, and the icon
// carries the text as its accessible name so screen readers get it without the hover.
export function InfoDot({ text, size = 12 }: { text: string; size?: number }) {
  const [open, setOpen] = useState(false)
  const show = () => setOpen(true)
  const hide = () => setOpen(false)
  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <span
        role="img"
        tabIndex={0}
        aria-label={text}
        onFocus={show}
        onBlur={hide}
        onClick={e => e.stopPropagation()}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[var(--fg-3)] hover:text-[var(--fg)] hover:bg-[var(--bg-3)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:text-[var(--fg)] transition-colors cursor-help"
      >
        <Icon name="info" size={size} />
      </span>
      {open && (
        <span role="tooltip" className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-40 w-[240px] px-2.5 py-1.5 bg-[var(--fg)] text-[var(--bg)] rounded-[6px] text-[11.5px] leading-snug shadow-lg pointer-events-none">
          {text}
        </span>
      )}
    </span>
  )
}
