import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

const WIDTH = {
  sm: 'w-[400px]',
  md: 'w-[520px]',
  lg: 'w-[720px]',
  xl: 'w-[880px]',
} as const

type Props = {
  open: boolean
  onClose: () => void
  title: string
  // Optional accent-tinted badge shown before the title, to anchor a header that
  // would otherwise be a lone title line.
  icon?: IconName
  description?: ReactNode
  width?: keyof typeof WIDTH
  footer?: ReactNode
  // Buttons rendered in the header, before the close X (e.g. an open-in-new-tab action).
  headerActions?: ReactNode
  // When false: X disabled, backdrop click no-ops, ESC no-ops. Use during in-flight requests
  // so the user can't half-confirm an action mid-write.
  dismissible?: boolean
  children: ReactNode
}

export function Modal({
  open, onClose, title, icon, description, width = 'md', footer, headerActions, children, dismissible = true,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (dismissible && e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, dismissible, onClose])

  useEffect(() => {
    if (!open) return
    cardRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [open])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          ref={cardRef}
          className={cn(
            'pointer-events-auto flex flex-col max-h-full bg-[var(--card)] border border-[var(--border)] rounded-[10px] shadow-2xl overflow-hidden',
            WIDTH[width],
            'max-w-full',
          )}
        >
          <div className="shrink-0 px-5 py-3.5 border-b border-[var(--border)] flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <span className="w-7 h-7 shrink-0 rounded-[7px] bg-[var(--accent-bg)] text-[var(--accent)] flex items-center justify-center">
                  <Icon name={icon} size={14} />
                </span>
              )}
              <div className="min-w-0">
                <div id="modal-title" className="text-[14px] font-medium text-[var(--fg)] tracking-tight">{title}</div>
                {description && <div className="text-[11.5px] text-[var(--fg-3)] mt-1 leading-snug">{description}</div>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {headerActions}
              <Button variant="ghost" size="iconSm" onClick={onClose} disabled={!dismissible} aria-label="Close">
                <Icon name="x" size={14} />
              </Button>
            </div>
          </div>
          <div className="p-5 overflow-y-auto min-h-0">{children}</div>
          {footer && (
            <div className="shrink-0 px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-2)] flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
