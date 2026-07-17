import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'

// High-contrast warning banner for destructive confirmations. Body text is `--fg`
// (not the muted modal-subtitle grey) so it reads clearly in both themes; lean on
// `--danger` spans inside `children` for emphasis.
export function DangerCallout({ icon = 'info', children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[8px] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3.5 py-3">
      <Icon name={icon} size={15} className="shrink-0 mt-0.5 text-[var(--danger)]" />
      <div className="text-[13px] leading-relaxed text-[var(--fg)]">{children}</div>
    </div>
  )
}
