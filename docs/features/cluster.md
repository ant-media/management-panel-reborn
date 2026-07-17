# Spec: Cluster view (Phase 14)

Status: **shipped**. Reads existing backend endpoints; no new backend.
Code: `src/features/cluster/` (`types.ts`, `parse.ts`, `use-cluster.ts`, `page.tsx`, `node-card.tsx`) + mock `src/lib/api/mocks/cluster.ts`.

**Locked decisions:**
1. **Cards today, table later.** Per-node cards, ported from the prototype. When clusters get large, swap to the dense table idiom; the hook/types/`parseNode` are layout-agnostic, only `node-card` changes.
2. **Trust the backend's binary status; add only a *derived* warn tier.** No fake 3-state status field: `status` stays the server's authoritative alive/dead; the client refines an *alive* node into healthy/warn from cpu/mem/db pressure.
3. **No node delete.** `DELETE /cluster/node/{id}` exists but a live node re-registers in 5s; this is a read-only health view (delete → TODO.md V2).

## Backend reality

**Enterprise + cluster-mode only.** Handlers are in community, but `getClusterStore()` is null without the enterprise cluster beans + Mongo/Redis cluster mode; a standalone server returns an empty list and `node-count = -1`. System-scoped (base `api`, not `appApi`).

```
GET /rest/v2/cluster-mode-status            → Result{success}   // success = in cluster mode
GET /rest/v2/cluster/node-count             → { number }        // -1 when not clustered
GET /rest/v2/cluster/nodes/{offset}/{size}  → ClusterNode[]
```

`ClusterNode` is **minimal + string-typed** (`io.antmedia.cluster.ClusterNode`):
- `cpu`: a **0-100 integer** carried as a *string* (Redis store) or *number* (Mongo store). Parse defensively.
- `memory`: `"usedMB/totalMB"`, integer MB (`"0/total"` on non-Linux).
- `dbQueryAveargeTimeMs`: int (the backend's misspelling; match it on the wire).
- `lastUpdateTime`: epoch ms of last heartbeat.
- `status`: server-computed **binary** `"alive"`/`"dead"` (dead = no heartbeat for >20s; heartbeat every 5s = `NODE_UPDATE_PERIOD`).
- `id`, `ip`.

## Architecture

### Data layer
- **`useCluster()`**: one `useApi` poll (5s) fetches `cluster-mode-status` + `cluster/nodes/0/1000` together (`Promise.all`) so "standalone" is distinguishable from "in-cluster, no nodes". Returns `{ inCluster, nodes, error, isLoading, isFetching, refresh, saveNote }`. Pagination deferred; clusters are small, fetch-all.
- **`parseNode(raw): NodeView`** normalises the wire (defensive cpu/mem parse → percentages + MB, nulls when unreported) and derives **health**: `dead` if the node is dead, else `warn` when cpu≥85 / mem≥90 / db≥30ms, else `healthy`. The component renders clean derived values (same discipline as `parseLogback`).

### Presentation
- **`ClusterPage`**: orchestrator. Health-count pills in the subtitle, a compact icon-chip **capacity summary** (Avg CPU/GPU, Active streams, Total viewers over alive nodes), the node grid, and three empty states (loading / **standalone** / in-cluster-no-nodes). Owns the note draft (`noteEdits` map, batched save bar) + toast for copy/show-logs.
- **`NodeCard`**: status dot + IP (click-to-copy) + last-seen + health pill on the header row; CPU/Memory/GPU meters; Streams/Viewers/DB-latency footer; a "Show logs" button (TODO) and the editable note pinned to the card bottom.

## Prototype gaps (mock-projected)

The prototype cards are aspirational. **streams / viewers / GPU per node** have **no backend** and are mock-projected as the swap point (parse treats them as optional, so the view degrades cleanly against a real backend): optional `RawClusterNode` fields the heartbeat will eventually grow; delete the mock when it does.

**Node notes are real:** `PUT /cluster/node/{id}/note?note=…` → `Result` persists an admin note server-side; empty string clears it, max 500 chars, and it survives the heartbeat + node restart. The mock is kept for offline dev. Backend design: [backend-analytics.md](backend-analytics.md).

The prototype's **"warn" status** is realised as a *derived* tier (above), not a backend field. The prototype's **per-node log download / "Show logs"** is genuinely unbuildable (see below).

## Gotchas
- **Standalone is the common case.** Every non-clustered install (every dev box) hits the empty list; the "this server is standalone" state is first-class, not an error.
- **String/number coercion.** `cpu` differs by store (string vs number); `memory` needs a `"used/total"` split; both can be null pre-first-heartbeat. `parseNode` guards all of it.
- **Trust server `status`.** It's computed at serialization time; don't recompute alive/dead client-side. Only the *warn* refinement is ours.
- **Delete semantics.** Deleting a live node is pointless (re-registers in 5s); if added later, gate it to dead/stale rows.

## Not in scope → TODO.md
- **Per-node logs**: no backend proxy to a specific node's `/log-file`. The `LogSource` seam is ready; revisit with a backend proxy (V2). "Show logs" is a TODO toast.
- **Node delete**, **dense table** for large clusters (both V2), and **origin/edge analytics** (Phase 19, V1).
- **Real per-node streams/viewers/GPU**: swap the mock for backend heartbeat fields, no UI change (V2). (Node **notes** are real; see "Prototype gaps" above.)
