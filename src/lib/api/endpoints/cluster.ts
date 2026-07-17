import { api } from '../client'
import type { Result } from '../types'
import type { RawClusterNode } from '@/features/cluster/types'

const id = (v: string) => encodeURIComponent(v)

// Node endpoints 500 on a standalone server; gate on modeStatus().success first.
export const cluster = {
  modeStatus: (signal?: AbortSignal) => api.get<Result>('/cluster-mode-status', { signal }),
  nodeCount: (signal?: AbortSignal) => api.get<{ number: number }>('/cluster/node-count', { signal }).then(r => r.number),
  nodes: (offset: number, size: number, signal?: AbortSignal) =>
    api.get<RawClusterNode[]>(`/cluster/nodes/${offset}/${size}`, { signal }),
  deleteNode: (nodeId: string) => api.delete<Result>(`/cluster/node/${id(nodeId)}`),
  saveNote: (nodeId: string, note: string) => api.put<Result>(`/cluster/node/${id(nodeId)}/note`, undefined, { query: { note } }),
}
