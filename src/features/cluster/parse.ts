import type { NodeHealth, NodeStatus, NodeView, RawClusterNode } from './types'

// An alive node crossing any of these reads as 'warn' (amber) rather than healthy.
// Derived client-side over real data; the backend status stays binary alive/dead.
const WARN_CPU = 85
const WARN_MEM = 90
const WARN_DB_MS = 30

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const clampPct = (n: number | null): number | null =>
  n == null ? null : Math.max(0, Math.min(100, Math.round(n)))

// Raw node → display-ready view. cpu arrives as "23"|23; memory as "usedMB/totalMB"
// (or null on non-Linux / pre-first-heartbeat). status is trusted from the server;
// health refines an alive node into healthy/warn from cpu/mem/db pressure.
export function parseNode(raw: RawClusterNode): NodeView {
  const status: NodeStatus = raw.status === 'dead' ? 'dead' : 'alive'
  const [usedRaw, totalRaw] = (raw.memory ?? '').split('/')
  const memUsedMB = toNum(usedRaw)
  const memTotalMB = toNum(totalRaw)
  const memPct = memUsedMB != null && memTotalMB ? clampPct((memUsedMB / memTotalMB) * 100) : null
  const cpuPct = clampPct(toNum(raw.cpu))
  const dbQueryMs = raw.dbQueryAveargeTimeMs ?? 0

  const stressed =
    (cpuPct != null && cpuPct >= WARN_CPU) ||
    (memPct != null && memPct >= WARN_MEM) ||
    dbQueryMs >= WARN_DB_MS
  const health: NodeHealth = status === 'dead' ? 'dead' : stressed ? 'warn' : 'healthy'

  return {
    id: raw.id,
    ip: raw.ip,
    status,
    health,
    cpuPct,
    memUsedMB,
    memTotalMB,
    memPct,
    gpuPct: clampPct(toNum(raw.gpu)),
    gpuModel: raw.gpuModel ?? null,
    dbQueryMs,
    streams: raw.streams ?? null,
    viewers: raw.viewers ?? null,
    note: raw.note ?? '',
    lastUpdateTime: raw.lastUpdateTime ?? 0,
  }
}
