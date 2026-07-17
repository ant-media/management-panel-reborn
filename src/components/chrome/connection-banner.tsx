import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { useConnectionStatus } from '@/contexts/connection-context'

// Slim strip under the topbar while the backend is unreachable; the page keeps its last data.
export function ConnectionBanner() {
  const { status, nextRetryIn, isProbing, retryNow } = useConnectionStatus()
  if (status === 'connected') return null
  return (
    <div
      role="status"
      className="shrink-0 flex items-center gap-2 px-4 py-1.5 text-[12px] bg-[var(--warn-bg)] text-[var(--warn)] border-b border-[var(--warn)]/25"
    >
      <Icon name="alert" size={13} aria-hidden />
      <span className="flex-1 min-w-0">
        {/* Static for screen readers; the live countdown is visual-only so it doesn't re-announce each second. */}
        <span className="sr-only">Connection lost, reconnecting.</span>
        <span aria-hidden>Connection lost. {isProbing ? 'Reconnecting…' : `Reconnecting in ${nextRetryIn}s…`}</span>
      </span>
      <Button variant="outline" size="sm" onClick={retryNow} disabled={isProbing}>Retry now</Button>
    </div>
  )
}
