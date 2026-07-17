import { useEffect } from 'react'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'

// Placeholder panel. The real server-wide event feed (persistence + filter + deep-link)
// is deferred to v2 (Phase 15 in docs/dev-progress/TODO.md). Kept as a designed
// "coming soon" state so the chrome stays intact without faking event data.

type Props = { open: boolean; onClose: () => void }

export function Notifications({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifs-title"
        className="fixed top-0 right-0 h-full w-[400px] bg-[var(--card)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl"
      >
        <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="bell" size={14} className="text-[var(--fg-3)]" aria-hidden />
            <span id="notifs-title" className="text-[13px] font-medium text-[var(--fg)]">Notifications</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close notifications">
            <Icon name="x" size={14} />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--bg-2)] border border-[var(--border)] flex items-center justify-center">
            <Icon name="cog" size={22} className="text-[var(--fg-3)]" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <div className="text-[14px] font-medium text-[var(--fg)]">Under construction</div>
            <p className="text-[12px] text-[var(--fg-3)] leading-relaxed max-w-[260px]">
              A live feed of server events (stream activity, errors, and resource alerts) is on the way in a future release.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--fg-3)] border border-[var(--border)] rounded-full px-2.5 py-1">
            Coming soon
          </span>
        </div>
      </aside>
    </>
  )
}
