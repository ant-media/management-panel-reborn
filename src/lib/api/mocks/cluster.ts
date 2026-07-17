import { registerMock } from '@/lib/api'
import type { RawClusterNode } from '@/features/cluster/types'

// Mock of the cluster endpoints. Mirrors the real wire shapes: cluster-mode-status
// is a Result{success}; nodes are string-typed ClusterNode rows (cpu "0-100",
// memory "usedMB/totalMB"). The note field + PUT note endpoint are real, mirrored here
// for offline dev; streams/viewers/gpu are NOT real yet, projected for a future heartbeat.
// One node is dead (stale heartbeat) and one alive node sits in the warn band so the
// derived health tiers are all visible. Alive nodes jitter each poll to feel live.
//
// Flip IN_CLUSTER to false to exercise the standalone empty state.
const IN_CLUSTER = true

const TOTAL_MB = 16031

let seed = 7
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) & 0x7fffffff
  return seed / 0x7fffffff
}
const jitter = (cur: number, lo: number, hi: number, step: number) =>
  Math.max(lo, Math.min(hi, Math.round(cur + (rnd() - 0.5) * step)))

type MockNode = {
  id: string
  ip: string
  alive: boolean
  cpu: number
  usedMB: number
  dbMs: number
  gpu: number | null
  gpuModel: string | null
  streams: number
  viewers: number
}

const fleet: MockNode[] = [
  { id: 'i-0a1b2c3d4e', ip: '10.0.2.181', alive: true, cpu: 34, usedMB: 6800, dbMs: 3, gpu: 47, gpuModel: 'NVIDIA T4', streams: 8, viewers: 1240 },
  { id: 'i-0f5e6d7c8b', ip: '10.0.2.182', alive: true, cpu: 71, usedMB: 14700, dbMs: 6, gpu: null, gpuModel: null, streams: 14, viewers: 3110 }, // mem ~92% ⇒ warn
  { id: 'i-0992aa1bb2', ip: '10.0.2.183', alive: true, cpu: 12, usedMB: 4100, dbMs: 2, gpu: null, gpuModel: null, streams: 3, viewers: 410 },
  { id: 'i-0dead00off', ip: '10.0.2.184', alive: false, cpu: 88, usedMB: 14800, dbMs: 41, gpu: null, gpuModel: null, streams: 0, viewers: 0 },
]

// Offline-dev store for the note write endpoint (real: PUT /cluster/node/{id}/note, persisted
// server-side against the node id and preserved across heartbeats).
const notes = new Map<string, string>([['i-0f5e6d7c8b', 'Origin · primary ingest']])

// Alive nodes drift each poll; the dead node keeps a stale heartbeat (~2 min old).
function row(n: MockNode): RawClusterNode {
  if (n.alive) {
    n.cpu = jitter(n.cpu, 5, 96, 14)
    n.usedMB = jitter(n.usedMB, 2500, TOTAL_MB - 400, 600)
    if (n.gpu != null) n.gpu = jitter(n.gpu, 3, 99, 12)
    n.streams = jitter(n.streams, 0, 40, 2)
    n.viewers = jitter(n.viewers, 0, 9000, 120)
  }
  return {
    id: n.id,
    ip: n.ip,
    cpu: String(n.cpu),
    memory: `${n.usedMB}/${TOTAL_MB}`,
    dbQueryAveargeTimeMs: n.dbMs,
    gpu: n.gpu,
    gpuModel: n.gpuModel,
    streams: n.streams,
    viewers: n.viewers,
    note: notes.get(n.id) ?? '',
    lastUpdateTime: n.alive ? Date.now() : Date.now() - 120_000,
    status: n.alive ? 'alive' : 'dead',
  }
}

registerMock('GET', '/rest/v2/cluster-mode-status', () => ({ success: IN_CLUSTER, message: '' }))

registerMock('GET', '/rest/v2/cluster/node-count', () => ({ number: IN_CLUSTER ? fleet.length : -1 }))

registerMock('GET', '/rest/v2/cluster/nodes/:offset/:size', ({ params }) => {
  if (!IN_CLUSTER) return []
  const offset = Math.max(0, Number(params.offset) || 0)
  const size = Math.max(0, Number(params.size) || 0)
  return fleet.map(row).slice(offset, offset + size)
})

registerMock('PUT', '/rest/v2/cluster/node/:id/note', ({ params, query }) => {
  const note = String(query.note ?? '')
  if (note) notes.set(params.id, note)
  else notes.delete(params.id)
  return { success: true }
})
