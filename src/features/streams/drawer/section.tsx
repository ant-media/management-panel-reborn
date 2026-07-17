import { type ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'
import { Collapse } from '@/components/shared/collapse'
import { useStoredState } from '@/lib/localStorage'
import { cn } from '@/lib/utils'

// Titled block of the drawer; untitled ones aren't sections, which is the always-expanded case.
// Stored so a collapse survives the drawer's remount on stream-switch. One key per section, never a
// shared map (parallel useStoredState copies clobber each other), holding `collapsed` so an absent
// or corrupt key reads as open.
export function Section({ id, title, meta, children }: {
  id: string
  title: string
  meta?: ReactNode
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useStoredState(`streams.drawer.${id}`, false)
  const bodyId = `drawer-section-${id}`

  return (
    <div className="border-t border-[var(--border)]">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        className="w-full flex items-center gap-2 px-5 py-3 text-left transition-colors hover:bg-[var(--bg-2)]"
      >
        <Icon
          name="chevron-down"
          size={12}
          className={cn('text-[var(--fg-3)] transition-transform duration-200 motion-reduce:transition-none', collapsed && '-rotate-90')}
        />
        <span className="text-[12.5px] font-medium text-[var(--fg)]">{title}</span>
        {meta && <span className="ml-auto text-[11px] text-[var(--fg-3)] truncate">{meta}</span>}
      </button>
      <Collapse open={!collapsed}>
        <div id={bodyId} className="px-5 pb-4">{children}</div>
      </Collapse>
    </div>
  )
}
