import { Icon, type IconName } from '@/components/ui/icon'
import type { Toast } from '@/lib/use-toast'

const KINDS: Record<Toast['kind'], { icon: IconName; cls: string }> = {
  ok: { icon: 'check', cls: 'bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok)]/30' },
  warn: { icon: 'alert', cls: 'bg-[var(--warn-bg)] text-[var(--warn)] border border-[var(--warn)]/30' },
  err: { icon: 'info', cls: 'bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger-border)]' },
}

// Inline status banner driven by useToast(). Render it at the top of a tab body:
//   {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}
export function ToastBanner({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const k = KINDS[toast.kind]
  return (
    <div role="status" className={`mb-3 px-3 py-2 rounded-[6px] text-[12px] flex items-start gap-2 ${k.cls}`}>
      <Icon name={k.icon} size={13} className="shrink-0 mt-px" />
      <span className="leading-snug">{toast.message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="ml-auto opacity-60 hover:opacity-100">
        <Icon name="x" size={12} />
      </button>
    </div>
  )
}
