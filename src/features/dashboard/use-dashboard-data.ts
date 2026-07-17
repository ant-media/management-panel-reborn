import { useMemo } from 'react'
import { useApi } from '@/lib/api/use-api'
import { server, system } from '@/lib/api/endpoints'

const SYS_POLL_MS = 5_000

// ── Wire types (subset of the umbrella /system-resources payload) ────────────
type CpuUsage = { systemCPULoad?: number; processCPULoad?: number }
type JvmMemory = { maxMemory?: number; totalMemory?: number; freeMemory?: number; inUseMemory?: number }
type SysMemory = { totalMemory?: number; freeMemory?: number; inUseMemory?: number; availableMemory?: number }
type FileSystemInfo = { totalSpace?: number; freeSpace?: number; usableSpace?: number; inUseSpace?: number }
type ServerTiming = { 'up-time'?: number; 'start-time'?: number }

// Embedded in /system-resources as `gpuUsageInfo` (and served standalone at /gpu-status).
// Real backend shape: util fields 0-100 ints, memory* in bytes, no temperature field.
type RawGpu = {
  index?: number
  deviceName?: string
  gpuUtilization?: number
  memoryUtilization?: number
  encoderUtilization?: number
  decoderUtilization?: number
  memoryTotal?: number
  memoryUsed?: number
  memoryFree?: number
}

export type SystemResources = {
  instanceId?: string
  cpuUsage?: CpuUsage
  jvmMemoryUsage?: JvmMemory
  systemMemoryInfo?: SysMemory
  fileSystemInfo?: FileSystemInfo
  dbAverageQueryTimeMs?: number
  localLiveStreams?: number
  localWebRTCLiveStreams?: number
  localWebRTCViewers?: number
  localHLSViewers?: number
  localDASHViewers?: number
  gpuUsageInfo?: RawGpu[]
  'server-timing'?: ServerTiming
}

// Network throughput. No real endpoint exists yet, served by a mock (`/network-status`).
export type NetworkStatus = {
  outboundMbps?: number
  inboundMbps?: number
  uplinkMbps?: number
}

export type ServerVersion = {
  versionName?: string
  versionType?: string
  buildNumber?: string
}

export type LicenceStatus = {
  licenceId?: string
  status?: string
  type?: string
  endDate?: string
  startDate?: string
  owner?: string
}

// ── Derived display shape ────────────────────────────────────────────────────
type Capacity = { pct: number; usedBytes: number; totalBytes: number; freeBytes: number }

export type GpuView = {
  index: number
  name: string
  utilPct: number
  memUtilPct: number
  memUsedBytes: number
  memTotalBytes: number
}

export type DashboardMetrics = {
  cpu:        { systemPct: number; processPct: number } | null
  systemMem:  Capacity | null
  disk:       Capacity | null
  heap:       Capacity | null
  live:       { streams: number; viewers: number; webrtc: number; hls: number; dash: number } | null
  gpus:       GpuView[]
  dbAvgMs:    number | null
  uptimeMs:   number | null
  instanceId: string | null
}

const EMPTY_METRICS: DashboardMetrics = {
  cpu: null, systemMem: null, disk: null, heap: null, live: null, gpus: [],
  dbAvgMs: null, uptimeMs: null, instanceId: null,
}

export type HistoryKey = 'cpu' | 'mem' | 'disk' | 'heap' | 'db' | 'live' | 'netOut' | 'netIn'
export type DashboardHistory = Record<HistoryKey, number[]>

const EMPTY_HISTORY: DashboardHistory = {
  cpu: [], mem: [], disk: [], heap: [], db: [], live: [], netOut: [], netIn: [],
}

// ── Derivation ───────────────────────────────────────────────────────────────
const pct = (used: number, total: number) =>
  total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0

const clampPct = (v?: number) => Math.max(0, Math.min(100, Math.round(v ?? 0)))

function capacity(used?: number, total?: number, free?: number): Capacity | null {
  if (total == null || total <= 0 || used == null) return null
  return {
    pct: pct(used, total),
    usedBytes: used,
    totalBytes: total,
    freeBytes: free ?? Math.max(0, total - used),
  }
}

function derive(sys: SystemResources | null): DashboardMetrics {
  if (!sys) return EMPTY_METRICS
  const cpu = sys.cpuUsage
  const sysMem = sys.systemMemoryInfo
  const fs = sys.fileSystemInfo
  const heap = sys.jvmMemoryUsage
  return {
    cpu: cpu ? {
      systemPct:  Math.max(0, cpu.systemCPULoad  ?? 0),
      processPct: Math.max(0, cpu.processCPULoad ?? 0),
    } : null,
    systemMem: capacity(sysMem?.inUseMemory, sysMem?.totalMemory, sysMem?.freeMemory),
    disk:      capacity(fs?.inUseSpace,      fs?.totalSpace,      fs?.freeSpace),
    heap:      capacity(heap?.inUseMemory,   heap?.maxMemory,     heap?.freeMemory),
    live: {
      streams: sys.localLiveStreams ?? 0,
      viewers: (sys.localWebRTCViewers ?? 0) + (sys.localHLSViewers ?? 0) + (sys.localDASHViewers ?? 0),
      webrtc:  sys.localWebRTCViewers ?? 0,
      hls:     sys.localHLSViewers ?? 0,
      dash:    sys.localDASHViewers ?? 0,
    },
    gpus: (sys.gpuUsageInfo ?? []).map((g, i) => ({
      index:        g.index ?? i,
      name:         g.deviceName || `GPU ${g.index ?? i}`,
      utilPct:      clampPct(g.gpuUtilization),
      memUtilPct:   clampPct(g.memoryUtilization),
      memUsedBytes: g.memoryUsed ?? 0,
      memTotalBytes: g.memoryTotal ?? 0,
    })),
    dbAvgMs:    sys.dbAverageQueryTimeMs ?? null,
    uptimeMs:   sys['server-timing']?.['up-time'] ?? null,
    instanceId: sys.instanceId ?? null,
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export type DashboardData = {
  metrics: DashboardMetrics
  history: DashboardHistory
  network: NetworkStatus | null
  version: ServerVersion | null
  licence: LicenceStatus | null
  error: Error | null
  isLoading: boolean
  refresh: () => void
}

export function useDashboardData(): DashboardData {
  const sys     = useApi<SystemResources>(        signal => system.resources(signal),        { pollMs: SYS_POLL_MS })
  const history = useApi<Partial<DashboardHistory>>(signal => system.resourcesHistory(signal),  { pollMs: SYS_POLL_MS })
  const network = useApi<NetworkStatus>(          signal => system.networkStatus(signal),    { pollMs: SYS_POLL_MS })
  const version = useApi<ServerVersion>(          signal => system.version(signal))
  const licence = useApi<LicenceStatus>(          signal => server.lastLicenceStatus(signal) as Promise<LicenceStatus>)

  const metrics = useMemo(() => derive(sys.data), [sys.data])

  // Merge per-key, not whole-object: the real /system-resources/history (Phase 16/17) may
  // omit keys this UI reads, notably netOut/netIn, which aren't part of system-resources.
  // Each missing series defaults to [] so a chart degrades to "Collecting…" instead of
  // crashing on `undefined.length`.
  const historyView = useMemo<DashboardHistory>(() => ({ ...EMPTY_HISTORY, ...history.data }), [history.data])

  const refresh = () => { sys.refresh(); history.refresh(); network.refresh(); version.refresh(); licence.refresh() }

  return {
    metrics,
    history: historyView,
    network: network.data,
    version: version.data,
    licence: licence.data,
    // History + network are decorative/optional: a missing endpoint must not banner the page.
    error:   sys.error ?? version.error ?? licence.error,
    isLoading: sys.isLoading,
    refresh,
  }
}
