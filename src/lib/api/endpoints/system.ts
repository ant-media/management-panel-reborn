import { api } from '../client'
import type { Result } from '../types'
import type { SystemResources, NetworkStatus, ServerVersion, DashboardHistory } from '@/features/dashboard/use-dashboard-data'

export const system = {
  resources: (signal?: AbortSignal) => api.get<SystemResources>('/system-resources', { signal }),
  version: (signal?: AbortSignal) => api.get<ServerVersion>('/version', { signal }),
  serverTime: (signal?: AbortSignal) => api.get<{ 'up-time': number; 'start-time': number }>('/server-time', { signal }),
  cpu: (signal?: AbortSignal) => api.get<unknown>('/cpu-status', { signal }),
  systemMemory: (signal?: AbortSignal) => api.get<unknown>('/system-memory-status', { signal }),
  jvmMemory: (signal?: AbortSignal) => api.get<unknown>('/jvm-memory-status', { signal }),
  fileSystem: (signal?: AbortSignal) => api.get<unknown>('/file-system-status', { signal }),
  liveClientsSize: (signal?: AbortSignal) => api.get<unknown>('/live-clients-size', { signal }),
  gpuStatus: (signal?: AbortSignal) => api.get<unknown[]>('/gpu-status', { signal }),
  systemStatus: (signal?: AbortSignal) => api.get<unknown>('/system-status', { signal }),
  threadDump: (signal?: AbortSignal) => api.get<string>('/thread-dump', { signal }),
  threads: (signal?: AbortSignal) => api.get<unknown>('/threads', { signal }),
  heapDump: (signal?: AbortSignal) => api.get<unknown>('/heap-dump', { signal }),
  gc: () => api.post<Result>('/system/gc'),
  liveness: (signal?: AbortSignal) => api.get<unknown>('/liveness', { signal }),
  shutdownStatus: (signal?: AbortSignal) => api.get<Result>('/shutdown-proper-status', { signal }),
  shutdownProperly: (signal?: AbortSignal) => api.get<Result>('/shutdown-properly', { signal }),

  // REAL: cpu/mem/disk/heap/db/live + netOut/netIn from StatsCollector's in-memory ring.
  // Per-key EMPTY_HISTORY merge still defaults any absent series to []. quiet: older servers 404 it.
  resourcesHistory: (signal?: AbortSignal) => api.get<Partial<DashboardHistory>>('/system-resources/history', { signal, quiet: true }),
  // REAL: physical-NIC throughput from StatsCollector (host-only, zero in containers; docs/dev-progress/TODO.md V2).
  networkStatus: (signal?: AbortSignal) => api.get<NetworkStatus>('/network-status', { signal, quiet: true }),
}
