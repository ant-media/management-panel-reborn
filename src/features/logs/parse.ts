// Logback line parsing. Backend serves a raw byte-slice of the log file; we turn it
// into structured rows. Pattern (conf/logback.xml): `%d{ISO8601} [%thread] %-5level %logger{35} - %msg%n`.

export type LogBucket = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'

export const LEVEL_BUCKETS: LogBucket[] = ['ERROR', 'WARN', 'INFO', 'DEBUG']

export const BUCKET_TONE: Record<LogBucket, string> = {
  ERROR: 'var(--danger)',
  WARN: 'var(--warn)',
  INFO: 'var(--info)',
  DEBUG: 'var(--fg-3)',
}

export interface LogEntry {
  id: string
  ts: string
  thread: string
  level: string
  bucket: LogBucket
  logger: string
  msg: string
  raw: string
}

const LINE_RE = /^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d{3}) \[([^\]]+)\] (\w+)\s+(\S+) - ([\s\S]*)$/

export function levelBucket(level: string): LogBucket {
  const u = level.toUpperCase()
  if (u === 'ERROR' || u === 'FATAL') return 'ERROR'
  if (u === 'WARN' || u === 'WARNING') return 'WARN'
  if (u === 'DEBUG' || u === 'TRACE') return 'DEBUG'
  return 'INFO'
}

// djb2 → base36. Content-addressed id so the same physical line keeps a stable React
// key across overlapping tail re-fetches (that's what makes the dedupe + no-flicker work).
function hashLine(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// `trimHead`: a byte-offset tail window almost always starts mid-line, drop everything
// before the first newline so the first row isn't garbage. (False when we hold the whole file.)
export function parseLogback(raw: string, trimHead: boolean): LogEntry[] {
  if (!raw) return []

  let text = raw
  if (trimHead) {
    const nl = text.indexOf('\n')
    text = nl === -1 ? '' : text.slice(nl + 1)
  }

  const lines = text.split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop() // trailing newline artifact

  const entries: LogEntry[] = []
  const seen = new Map<string, number>() // disambiguate exact-duplicate lines within a window
  for (const line of lines) {
    const m = LINE_RE.exec(line)
    if (!m) {
      // Continuation (stack-trace line, wrapped message): fold into the previous entry.
      const prev = entries[entries.length - 1]
      if (prev) {
        prev.msg += '\n' + line
        prev.raw += '\n' + line
      }
      continue
    }
    const base = hashLine(line)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    const [, ts, thread, level, logger, msg] = m
    entries.push({
      id: n ? `${base}-${n}` : base,
      ts, thread, level, bucket: levelBucket(level), logger, msg, raw: line,
    })
  }
  return entries
}
