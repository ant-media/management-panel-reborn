import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api'

// Non-blocking page-load error + Retry. Self-resolves as polls recover. (Modal submits use FormError.)
export function LoadErrorBanner({
  entity, error, onRetry, className,
}: {
  entity: string
  error: Error
  onRetry: () => void
  className?: string
}) {
  return (
    <Card className={cn('p-4 mb-4 border-[var(--danger-border)] bg-[var(--danger-bg)]', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--danger)] min-w-0">
          <Icon name="info" size={14} />
          <span className="truncate">Could not load {entity}: {errorMessage(error, 'the server gave no reason')}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div>
    </Card>
  )
}
