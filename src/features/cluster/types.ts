// Cluster node health. The backend ClusterNode is minimal and string-typed:
// `cpu` is a 0-100 integer carried as a string (Mongo store) or number (Redis store);
// `memory` is "usedMB/totalMB"; `status` is server-computed binary alive/dead
// (dead = no heartbeat for >20s). parse.ts normalises the raw wire into NodeView.
//
// `note` is a real backend field: admin-set, persisted via PUT /cluster/node/{id}/note and
// returned on every node row (null/absent when unset). streams/viewers are real heartbeat load
// (absent from a node on an older server); gpu is NOT in the backend yet, mock-projected. parse.ts
// treats every optional field as absent-safe, so the view degrades cleanly.

export interface RawClusterNode {
  id: string
  ip: string
  lastUpdateTime: number // epoch ms of last heartbeat
  memory: string | null // "usedMB/totalMB", integer MB
  cpu: string | number | null // 0-100
  dbQueryAveargeTimeMs: number // backend's spelling, match it on the wire
  status: string // 'alive' | 'dead'
  note?: string | null // admin-set note; null/absent when unset
  streams?: number | null // streams ingested on this node
  viewers?: number | null // players this node serves (WebRTC+HLS+DASH), edge pulls excluded
  // --- not yet real (mock-projected) ---
  gpu?: string | number | null // 0-100 util; absent ⇒ no GPU
  gpuModel?: string | null
}

export type NodeStatus = 'alive' | 'dead'
// Derived (client-side) over real data: an alive-but-stressed node reads as 'warn'.
export type NodeHealth = 'healthy' | 'warn' | 'dead'

export interface NodeView {
  id: string
  ip: string
  status: NodeStatus
  health: NodeHealth
  cpuPct: number | null // null when not yet reported
  memUsedMB: number | null
  memTotalMB: number | null
  memPct: number | null
  gpuPct: number | null // null ⇒ no GPU on this node
  gpuModel: string | null
  dbQueryMs: number
  streams: number | null
  viewers: number | null
  note: string
  lastUpdateTime: number
}
