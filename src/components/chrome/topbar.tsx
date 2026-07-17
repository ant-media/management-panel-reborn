import { useMatches, type UIMatch } from 'react-router'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/shared/pill'
import { Tooltip } from '@/components/shared/tooltip'
import { useConnectionStatus } from '@/contexts/connection-context'
import { useTheme } from '@/contexts/theme-context'
import { fmtAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

type BreadcrumbHandle = {
  breadcrumb?: string | ((params: Record<string, string | undefined>) => string)
}

type Props = {
  onOpenNotifs: () => void
  onOpenTweaks: () => void
  notifCount: number
}

export function Topbar({ onOpenNotifs, onOpenTweaks, notifCount }: Props) {
  const crumbs = useBreadcrumbs()
  const { effectiveDark, setTheme } = useTheme()

  return (
    <div className="h-12 shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-4 flex items-center gap-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] min-w-0 flex-1">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <Icon name="chevron-right" size={11} className="text-[var(--fg-3)] shrink-0" aria-hidden />}
            <span
              aria-current={i === crumbs.length - 1 ? 'page' : undefined}
              className={cn('whitespace-nowrap', i === crumbs.length - 1 ? 'text-[var(--fg)] font-medium' : 'text-[var(--fg-3)]')}
            >
              {c}
            </span>
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-0.5 shrink-0">
        <ConnectionPill />
        <button
          type="button"
          onClick={() => setTheme(effectiveDark ? 'light' : 'dark')}
          aria-label={effectiveDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-9 h-9 rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-2)] text-[var(--fg)] hover:bg-[var(--bg-3)] hover:border-[var(--fg-3)] flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Icon name={effectiveDark ? 'sun' : 'moon'} size={16} />
        </button>
        <button
          type="button"
          onClick={onOpenTweaks}
          aria-label="Open tweaks"
          className="w-8 h-8 rounded-[6px] text-[var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[var(--fg-2)] flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Icon name="cog" size={15} />
        </button>
        <button
          type="button"
          onClick={onOpenNotifs}
          aria-label={`Notifications${notifCount > 0 ? ` (${notifCount} unread)` : ''}`}
          className="relative w-8 h-8 rounded-[6px] text-[var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[var(--fg-2)] flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Icon name="bell" size={14} />
          {notifCount > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--warn)]" aria-hidden />}
        </button>
      </div>
    </div>
  )
}

// Separate consumer so the per-second countdown re-renders only the pill, not the whole topbar.
function ConnectionPill() {
  const { status, nextRetryIn, isProbing, lastConnectedAt } = useConnectionStatus()
  if (status === 'connected') return <Pill tone="ok" dot>connected</Pill>
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-[var(--fg)]">Backend unreachable</span>
          <span>Last connected {fmtAgo(lastConnectedAt ?? 0)}</span>
          <span>{isProbing ? 'Checking now…' : `Retrying in ${nextRetryIn}s`}</span>
        </div>
      }
    >
      <Pill tone="warn" dot pulse>Disconnected</Pill>
    </Tooltip>
  )
}

function useBreadcrumbs(): string[] {
  const matches = useMatches() as UIMatch<unknown, BreadcrumbHandle | undefined>[]
  return matches.flatMap(m => {
    const b = m.handle?.breadcrumb
    if (!b) return []
    const v = typeof b === 'function' ? b(m.params) : b
    return v ? [v] : []
  })
}
