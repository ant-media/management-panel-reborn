import { memo } from 'react'
import { cn } from '@/lib/utils'
import { BUCKET_TONE, type LogEntry } from './parse'

const BORDER: Record<string, string> = {
  ERROR: 'border-[var(--danger)]',
  WARN: 'border-[var(--warn)]',
  INFO: 'border-transparent',
  DEBUG: 'border-transparent opacity-70',
}

export const LogRow = memo(function LogRow({ entry, wrap }: { entry: LogEntry; wrap: boolean }) {
  return (
    <div className={cn('px-5 py-1 flex items-baseline gap-3 hover:bg-[var(--bg-3)] border-l-2', BORDER[entry.bucket])}>
      <span className="text-[var(--fg-3)] tabular-nums w-[180px] shrink-0">{entry.ts}</span>
      <span className="w-[44px] shrink-0 font-medium" style={{ color: BUCKET_TONE[entry.bucket] }}>{entry.level}</span>
      <span className="text-[var(--fg-3)] w-[200px] shrink-0 truncate" title={entry.logger}>[{entry.logger}]</span>
      <span className={cn('flex-1 min-w-0 text-[var(--fg-2)]', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto')}>
        {entry.msg}
      </span>
    </div>
  )
})
