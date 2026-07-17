import { registerMock } from '@/lib/api'

const GB = 1024 ** 3
const startedAt = Date.now() - 4 * 3600_000 + Math.floor(Math.random() * 3600_000)

const rng = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

registerMock('GET', '/rest/v2/version', () => ({
  versionType: 'Enterprise',
  versionName: '2.17.1',
  buildNumber: 'mock-build',
}))

registerMock('GET', '/rest/v2/cpu-status', () => ({
  processCPULoad: rng(12, 42),
  systemCPULoad:  rng(25, 65),
  processCPUTime: Date.now(),
  systemLoadAverageLastMinute: rng(0.5, 2),
}))

registerMock('GET', '/rest/v2/system-memory-status', () => {
  const total = 16 * GB
  const inUse = total * rng(0.4, 0.6)
  return {
    virtualMemory: 32 * GB,
    totalMemory:   total,
    freeMemory:    total - inUse,
    inUseMemory:   inUse,
    availableMemory: total - inUse,
  }
})

registerMock('GET', '/rest/v2/jvm-memory-status', () => {
  const max = 4 * GB
  const inUse = max * rng(0.3, 0.7)
  return { maxMemory: max, totalMemory: max, freeMemory: max - inUse, inUseMemory: inUse }
})

registerMock('GET', '/rest/v2/file-system-status', () => {
  const total = 500 * GB
  const usable = total * 0.4
  return { freeSpace: usable, totalSpace: total, usableSpace: usable, inUseSpace: total - usable }
})

registerMock('GET', '/rest/v2/live-clients-size', () => ({
  totalConnectionSize: Math.floor(Math.random() * 50),
  totalLiveStreamSize: Math.floor(Math.random() * 5),
}))

// GPU stats: a REAL backend surface. `GET /rest/v2/gpu-status` returns this array and
// `/system-resources` embeds it as `gpuUsageInfo` (StatsCollector.getGPUInfoJSObject).
// Field names + types mirror the server: gpuUtilization/memoryUtilization are 0-100 ints,
// memory* are bytes, deviceName is a string. The server has NO temperature field. Two
// devices exercise the multi-GPU breakdown; set GPU_COUNT to 0 to hide the GPU card.
const GPU_COUNT = 2
const gpuState = Array.from({ length: GPU_COUNT }, (_, index) => ({
  index,
  name: index % 2 === 0 ? 'NVIDIA A10' : 'NVIDIA T4',
  total: (index % 2 === 0 ? 24 : 16) * GB,
  util: 30 + index * 14,
  memUtil: 28 + index * 10,
}))

function gpuInfo() {
  return gpuState.map(g => {
    g.util = Math.max(0, Math.min(100, Math.round(g.util + (Math.random() * 2 - 1) * 12)))
    g.memUtil = Math.max(0, Math.min(100, Math.round(g.memUtil + (Math.random() * 2 - 1) * 6)))
    const memoryUsed = Math.round(g.total * (g.memUtil / 100))
    return {
      index: g.index,
      deviceName: g.name,
      gpuUtilization: g.util,
      memoryUtilization: g.memUtil,
      encoderUtilization: Math.max(0, g.util - 8),
      decoderUtilization: Math.max(0, g.util - 14),
      memoryTotal: g.total,
      memoryUsed,
      memoryFree: g.total - memoryUsed,
    }
  })
}

registerMock('GET', '/rest/v2/gpu-status', () => gpuInfo())

// REAL: /network-status is served by StatsCollector (physical-NIC throughput, host-only).
// Mock kept for offline dev; drifts egress/ingress each poll. Shape: { outboundMbps, inboundMbps, uplinkMbps }.
const UPLINK_MBPS = 200
const net = { out: 95, in: 38 }

registerMock('GET', '/rest/v2/network-status', () => {
  net.out = Math.max(0, Math.min(UPLINK_MBPS, Math.round((net.out + (Math.random() * 2 - 1) * 16) * 10) / 10))
  net.in = Math.max(0, Math.min(UPLINK_MBPS, Math.round((net.in + (Math.random() * 2 - 1) * 9) * 10) / 10))
  return { outboundMbps: net.out, inboundMbps: net.in, uplinkMbps: UPLINK_MBPS }
})

// Umbrella endpoint the dashboard actually consumes; keep its derived values
// loosely in sync with the per-metric mocks above so any UI that mixes both still reads sanely.
registerMock('GET', '/rest/v2/system-resources', () => {
  const sysTotal = 16 * GB,  sysUsed  = sysTotal * rng(0.4, 0.6)
  const heapMax  = 4 * GB,   heapUsed = heapMax  * rng(0.3, 0.7)
  const diskTot  = 500 * GB, diskUse  = diskTot  * rng(0.55, 0.65)
  const liveStreams = Math.floor(rng(0, 6))
  return {
    instanceId: 'mock-instance-0001',
    cpuUsage: { processCPULoad: rng(12, 42), systemCPULoad: rng(25, 65), processCPUTime: Date.now(), systemLoadAverageLastMinute: rng(0.5, 2) },
    jvmMemoryUsage:   { maxMemory: heapMax, totalMemory: heapMax, freeMemory: heapMax - heapUsed, inUseMemory: heapUsed },
    systemMemoryInfo: { virtualMemory: 32 * GB, totalMemory: sysTotal, freeMemory: sysTotal - sysUsed, inUseMemory: sysUsed, availableMemory: sysTotal - sysUsed },
    fileSystemInfo:   { totalSpace: diskTot, freeSpace: diskTot - diskUse, usableSpace: diskTot - diskUse, inUseSpace: diskUse },
    dbAverageQueryTimeMs: Math.round(rng(2, 18)),
    localLiveStreams: liveStreams,
    localWebRTCLiveStreams: liveStreams,
    localWebRTCViewers: Math.floor(rng(0, 30)),
    localHLSViewers:    Math.floor(rng(0, 15)),
    localDASHViewers:   Math.floor(rng(0, 5)),
    gpuUsageInfo: gpuInfo(),
    'server-timing': { 'up-time': Date.now() - startedAt, 'start-time': startedAt },
  }
})

// /system-resources/history (REAL): the server serves cpu/mem/disk/heap/db/live + netOut/netIn
// from an in-memory ring (StatsCollector). netOut/netIn are physical-NIC throughput (host-only).
// Mock kept for offline dev: random-walks one sample per poll, ships pre-filled.
const HISTORY_CAP = 60

type Walker = { v: number; lo: number; hi: number; step: number; whole?: boolean }
const walkers: Record<string, Walker> = {
  cpu:  { v: 40, lo: 18, hi: 72, step: 6 },
  mem:  { v: 52, lo: 40, hi: 64, step: 2 },
  disk: { v: 60, lo: 58, hi: 63, step: 0.4 },
  heap: { v: 50, lo: 28, hi: 74, step: 5 },
  db:   { v: 8,  lo: 2,  hi: 18, step: 2.5, whole: true },
  live: { v: 3,  lo: 0,  hi: 6,  step: 1.2, whole: true },
  netOut: { v: 95, lo: 40, hi: 180, step: 18 },
  netIn:  { v: 38, lo: 10, hi: 90,  step: 9 },
}

const history: Record<string, number[]> = Object.fromEntries(Object.keys(walkers).map(k => [k, []]))

function advance() {
  for (const k in walkers) {
    const w = walkers[k]
    w.v = Math.max(w.lo, Math.min(w.hi, w.v + (Math.random() * 2 - 1) * w.step))
    history[k].push(w.whole ? Math.round(w.v) : Math.round(w.v * 10) / 10)
    if (history[k].length > HISTORY_CAP) history[k].shift()
  }
}
for (let i = 0; i < HISTORY_CAP; i++) advance()

registerMock('GET', '/rest/v2/system-resources/history', () => {
  advance()
  return Object.fromEntries(Object.entries(history).map(([k, buf]) => [k, [...buf]]))
})

const mockLicence = () => ({
  licenceId: 'mock-licence-id',
  status:    'OK',
  type:      'enterprise',
  startDate: '2025-01-01',
  endDate:   '2026-12-31',
  owner:     'mock-owner',
})
// /licence-status is the empty-on-live one; consumers read /last-licence-status. Both mocked.
registerMock('GET', '/rest/v2/licence-status', mockLicence)
registerMock('GET', '/rest/v2/last-licence-status', mockLicence)
