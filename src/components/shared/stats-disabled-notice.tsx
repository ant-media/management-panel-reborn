import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { CodeChip } from './code-chip'

// Shown in place of a viewer graph when an app's writeStatsToDatastore is off (counts read 0).
export function StatsDisabledNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 text-center px-3 py-2 rounded border border-dashed border-[var(--border)]',
        className,
      )}
    >
      <Icon name="eye-off" size={15} className="text-[var(--fg-3)]" />
      <div className="text-[11.5px] font-medium text-[var(--fg-2)]">Stats disabled for this app</div>
      <div className="text-[10.5px] text-[var(--fg-3)] leading-snug">
        Enable <CodeChip className="text-[10px] px-1 py-0">writeStatsToDatastore</CodeChip> to collect viewer metrics
      </div>
    </div>
  )
}
