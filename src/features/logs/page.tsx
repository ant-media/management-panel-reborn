import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { downloadFile } from '@/lib/download'
import { useStoredState } from '@/lib/localStorage'
import { LOG_SOURCES } from './log-sources'
import { useLogTail } from './use-log-tail'
import { LEVEL_BUCKETS, type LogBucket } from './parse'
import { LogToolbar } from './log-toolbar'
import { LogConsole } from './log-console'

const TAIL_BYTES = 256_000

const ZERO_COUNTS: Record<LogBucket, number> = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 }

export function LogsPage() {
  const [sourceId, setSourceId] = useStoredState('logs.source', 'server')
  const [levels, setLevels] = useStoredState<LogBucket[]>('logs.levels', LEVEL_BUCKETS)
  const [intervalMs, setIntervalMs] = useStoredState('logs.interval', 5000)
  const [follow, setFollow] = useStoredState('logs.follow', true)
  const [wrap, setWrap] = useStoredState('logs.wrap', true)
  const [cap, setCap] = useStoredState('logs.cap', 1500)
  const [search, setSearch] = useState('')
  const [paused, setPaused] = useState(false)

  const source = useMemo(() => LOG_SOURCES.find(s => s.id === sourceId) ?? LOG_SOURCES[0], [sourceId])
  const live = !paused && intervalMs > 0

  const { entries, isFetching, error, refresh } = useLogTail(source, {
    charSize: TAIL_BYTES,
    pollMs: paused ? 0 : intervalMs,
    cap,
  })

  const counts = useMemo(() => {
    const c = { ...ZERO_COUNTS }
    for (const e of entries) c[e.bucket]++
    return c
  }, [entries])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      if (!levels.includes(e.bucket)) return false
      if (!q) return true
      return e.msg.toLowerCase().includes(q) || e.logger.toLowerCase().includes(q) || e.thread.toLowerCase().includes(q)
    })
  }, [entries, levels, search])

  const toggleLevel = (b: LogBucket) => setLevels(cur => (cur.includes(b) ? cur.filter(x => x !== b) : [...cur, b]))

  const onDownload = () => {
    if (!entries.length) return
    downloadFile(source.fileName, entries.map(e => e.raw).join('\n'), 'text/plain')
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
        <h1 className="sr-only">Logs</h1>
        <div className="flex items-center gap-2 text-[12px] text-[var(--fg-3)] min-w-0">
          <Icon name="terminal" size={13} className="shrink-0" />
          <span className="font-mono truncate">log/{source.fileName}</span>
        </div>
        <Button onClick={onDownload} disabled={!entries.length} title="Download the loaded lines">
          <Icon name="download" size={12} /> Download
        </Button>
      </div>

      <LogToolbar
        sources={LOG_SOURCES}
        sourceId={sourceId}
        onSource={setSourceId}
        search={search}
        onSearch={setSearch}
        counts={counts}
        levels={levels}
        onToggleLevel={toggleLevel}
        intervalMs={intervalMs}
        onInterval={setIntervalMs}
        paused={paused}
        onPause={() => setPaused(p => !p)}
        follow={follow}
        onFollow={setFollow}
        wrap={wrap}
        onWrap={setWrap}
        cap={cap}
        onCap={setCap}
      />

      {error && !isFetching && (
        <div className="px-5 pt-3">
          <LoadErrorBanner entity="logs" error={error} onRetry={refresh} />
        </div>
      )}

      <LogConsole
        rows={visible}
        wrap={wrap}
        follow={follow}
        onResumeFollow={() => setFollow(true)}
        loadedCount={entries.length}
        live={live}
        paused={paused}
      />
    </div>
  )
}
