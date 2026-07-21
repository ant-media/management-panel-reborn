import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { LogRow } from './log-row'
import type { LogEntry } from './parse'

type Props = {
  rows: LogEntry[]
  wrap: boolean
  follow: boolean
  onResumeFollow: () => void
  loadedCount: number
  live: boolean
  paused: boolean
}

// Distance from the bottom (px) still counted as "pinned"; tolerates sub-pixel rounding.
const BOTTOM_SLOP = 24

export function LogConsole({ rows, wrap, follow, onResumeFollow, loadedCount, live, paused }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLOP)
  }

  // Stick to the tail only while the user is already pinned to the bottom and following,
  // never yank a user who has scrolled up to read.
  useLayoutEffect(() => {
    if (follow && atBottom && ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [rows, follow, atBottom])

  // Re-pin when the switch is flipped back on.
  useEffect(() => {
    if (follow && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
      setAtBottom(true)
    }
  }, [follow])

  const jumpToBottom = () => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setAtBottom(true)
    onResumeFollow()
  }

  return (
    <div className="flex-1 min-h-0 relative flex flex-col">
      <div ref={ref} onScroll={onScroll} className="flex-1 overflow-auto bg-[var(--bg-2)] font-mono text-[11.5px] leading-[1.55]">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-[var(--fg-3)] text-[12px]">
            {loadedCount === 0 ? 'No log output yet.' : 'No lines match these filters.'}
          </div>
        ) : (
          rows.map(e => <LogRow key={e.id} entry={e} wrap={wrap} />)
        )}
      </div>

      {!atBottom && (
        <button
          onClick={jumpToBottom}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 h-7 px-3 inline-flex items-center gap-1.5 text-[11.5px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-full shadow-md text-[var(--fg-2)]"
        >
          <Icon name="chevron-down" size={12} /> Jump to latest
        </button>
      )}

      <div className="px-5 py-2 text-[10.5px] text-[var(--fg-3)] border-t border-[var(--border)] flex items-center gap-2">
        {paused ? (
          <><span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)]" /> Paused</>
        ) : live ? (
          <><span className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-pulse" /> Live tail</>
        ) : (
          <><span className="w-1.5 h-1.5 rounded-full bg-[var(--fg-3)]" /> Snapshot</>
        )}
        <span>· {rows.length} of {loadedCount} loaded lines shown</span>
        <span className="text-[var(--fg-3)]">· counts &amp; search cover the loaded window only</span>
      </div>
    </div>
  )
}
