import { registerMock } from '@/lib/api'

// Mock of GET /log-file/{offset}/{charSize}. Returns the real wire shape
// { logContent, logContentSize, logFileSize } from a logback-formatted fixture,
// sliced by BYTE offset (so the partial-first-line / head-trim path is exercised),
// and grows over real time so the live-tail append/reconcile is exercised too.

const MAX_CHAR_SIZE = 512_000

const THREADS = ['vert.x-eventloop-thread-1', 'vert.x-eventloop-thread-3', 'vert.x-worker-thread-9', 'https-jsse-nio2-0.0.0.0-5443-exec-63']
const LOGGERS = ['i.a.plugin.LowLatencyHLSPlugin', 'io.antmedia.muxer.MuxAdaptor', 'i.a.e.w.WebSocketEnterpriseHandler', 'io.antmedia.AntMediaApplicationAdapter']
const MSGS = [
  ['INFO', 'Stream queue size: 0 speed: 1.001 for streamId: aljamaltv'],
  ['INFO', 'Finalized 868748 bytes in webapps/live/streams/ll-hls/aljamaltv/1080/aljamaltv__3021.2.ts'],
  ['INFO', 'WebRTC connection established · 10.0.2.181'],
  ['DEBUG', 'Stream adaptor queue size: 0 for stream: ndi'],
  ['INFO', 'Client subscribed to broadcast main-stage-cam'],
  ['WARN', 'Bitrate spike on stream "test" (+35%)'],
  ['INFO', 'HLS segment rollover for stream main-stage-cam'],
  ['ERROR', 'Sending broadcast not found response for streamId: streamId_272hCev0k'],
] as const

const pad = (n: number, l = 2) => String(n).padStart(l, '0')
const fmtTs = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())},${pad(d.getMilliseconds(), 3)}`

const fmtLine = (d: Date, thread: string, level: string, logger: string, msg: string) =>
  `${fmtTs(d)} [${thread}] ${level.padEnd(5)} ${logger} - ${msg}`

let seed = 99
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) & 0x7fffffff
  return seed / 0x7fffffff
}
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]

function nextEvent(clock: Date): { line: string; at: Date } {
  const at = new Date(clock.getTime() + Math.floor(rnd() * 1100) + 120)
  const [level, msg] = pick(MSGS)
  return { line: fmtLine(at, pick(THREADS), level, pick(LOGGERS), msg), at }
}

type Fixture = { lines: string[]; clock: Date; lastGrow: number }

function seedFixture(count: number, start: Date): Fixture {
  const lines: string[] = []
  let clock = start
  for (let i = 0; i < count; i++) {
    const e = nextEvent(clock)
    lines.push(e.line)
    clock = e.at
  }
  return { lines, clock, lastGrow: Date.now() }
}

// A multi-line entry so the continuation-fold path has something to chew on.
const STACK_TRACE = [
  'java.io.IOException: No space left on device',
  '\tat java.base/java.io.FileOutputStream.writeBytes(Native Method)',
  '\tat io.antmedia.muxer.Mp4Muxer.writeTrailer(Mp4Muxer.java:412)',
  '\tat io.antmedia.muxer.MuxAdaptor.closeResources(MuxAdaptor.java:1604)',
]

const server = seedFixture(140, new Date(2026, 5, 14, 9, 8, 40))
const errors = seedFixture(0, new Date(2026, 5, 14, 9, 9, 0))
errors.lines.push(
  fmtLine(new Date(2026, 5, 14, 9, 11, 58, 210), 'vert.x-worker-thread-9', 'ERROR', 'io.antmedia.muxer.MuxAdaptor', 'Recording write failed: disk quota exceeded'),
  ...STACK_TRACE,
  fmtLine(new Date(2026, 5, 14, 9, 12, 31, 44), 'vert.x-eventloop-thread-3', 'WARN', 'io.antmedia.AntMediaApplicationAdapter', 'Node 10.0.2.184 CPU above 80% threshold'),
)

// Append a fresh line at most ~once/1.2s of wall-clock so polling sees the file grow.
function grow(fx: Fixture, errorOnly: boolean) {
  const now = Date.now()
  if (now - fx.lastGrow < 1200) return
  fx.lastGrow = now
  const at = new Date()
  if (errorOnly) {
    fx.lines.push(fmtLine(at, pick(THREADS), rnd() > 0.5 ? 'WARN' : 'ERROR', pick(LOGGERS), pick(MSGS)[1]))
  } else {
    const [level, msg] = pick(MSGS)
    fx.lines.push(fmtLine(at, pick(THREADS), level, pick(LOGGERS), msg))
  }
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function slice(fx: Fixture, offsetRaw: string, charRaw: string) {
  const offset = Number(offsetRaw)
  const charSize = Math.min(Number(charRaw) || 0, MAX_CHAR_SIZE)
  const bytes = enc.encode(fx.lines.join('\n') + '\n')
  const logFileSize = bytes.length
  if (!logFileSize) return { logContent: 'There is no log yet' }
  const start = offset === -1 ? Math.max(0, logFileSize - charSize) : Math.min(Math.max(offset, 0), logFileSize)
  const chunk = bytes.slice(start, start + charSize)
  return { logContent: dec.decode(chunk), logContentSize: chunk.length, logFileSize }
}

registerMock('GET', '/rest/v2/log-file/:offset/:charSize', ({ query, params }) => {
  const errorOnly = String(query.logType ?? '') === 'error'
  const fx = errorOnly ? errors : server
  grow(fx, errorOnly)
  return slice(fx, params.offset, params.charSize)
})
