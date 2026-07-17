import { Icon } from '@/components/ui/icon'
import type { Toast } from '@/lib/use-toast'

// Inline status banner driven by useToast(). Render it at the top of a tab body:
//   {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}
export function ToastBanner({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const ok = toast.kind === 'ok'
  return (
    <div
      role="status"
      className={`mb-3 px-3 py-2 rounded-[6px] text-[12px] flex items-start gap-2 ${
        ok
          ? 'bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok)]/30'
          : 'bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger-border)]'
      }`}
    >
      <Icon name={ok ? 'check' : 'info'} size={13} className="shrink-0 mt-px" />
      <span className="leading-snug">{toast.message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="ml-auto opacity-60 hover:opacity-100">
        <Icon name="x" size={12} />
      </button>
    </div>
  )
}
