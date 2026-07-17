# Backend analytics (Phase C + Phase 16)

Design + invariants for the five backend analytics endpoints the panel uses. The code
lives in Ant-Media-Server (community), plus Ant-Media-Enterprise for the cluster stores.
Wire contracts: [API.md](../API.md). Open verification + tests: [TODO.md](../dev-progress/TODO.md).

## REST house style

- Server-level endpoints: business method in `CommonRestService`, a `@GET`/`@Path` shim in
  `RestServiceV2` delegating `super.*()`; reach the collector via `getStatsCollector()`.
  The per-stream endpoint is app-scoped instead (`BroadcastRestService`).
- Cluster controller (`ClusterRestServiceV2`): pass a single scalar as `@QueryParam`; do not
  create a DTO class for one field (matches `getLicenceStatus` / `configureSsl`).
- All history config keys ship as `@Value` defaults, so no conf-file change is needed to run.

## `GET /system-resources/history`

- `StatsCollector` gets a dedicated Vert.x periodic (its own timer; the 1Hz CPU sampler and
  GPU/nvml are untouched) sampling six metrics into an in-memory
  `ConcurrentLinkedQueue<ResourceSample>` ring: `cpu` (rolling `cpuLoad`), `mem`/`disk`/`heap`
  (in-use % via the same `SystemUtils` calls `/system-resources` uses), `db`
  (`getDBQueryAverageTimeMs()`), `live` (summed `MuxAdaptor` counts).
- Config: `server.metrics_history_sample_period_ms` (5000) + `server.metrics_history_size` (60).
- Local node only; in-memory (lost on restart).
- This sampler touches only in-memory state, so it is safe unwrapped on the event loop
  (unlike the per-app sampler below).

## `GET /network-status` (+ `netOut`/`netIn` history series)

- The same history sampler derives throughput from cumulative NIC byte counters: sums
  `/sys/class/net/<if>/statistics/{rx,tx}_bytes` over **physical NICs only** (an iface is
  physical iff `/sys/class/net/<if>/device` exists, which skips `lo`, bridges, `veth`,
  `docker0`, bonds, vlans, tun/tap), deltas over `System.nanoTime()`, converts to Mbps.
- Negative deltas (counter reset) clamp to 0; the first sample only seeds the baseline.
  `uplinkMbps` = sum of each physical NIC's `/sys/class/net/<if>/speed` (best-effort).
- Unprivileged reads, no new dependency (matches the `SystemUtils` direct-file-read style).
- **Container caveat:** inside Docker, `eth0` is a veth with no `/device` entry, so the physical
  set is empty and a containerized AMS reports zero. Fallback options are code-commented at
  `readPhysicalNetworkTotals` in `StatsCollector.java`; tracked as a V2 item.

## `GET /applications/{name}/metrics-history`

- Per-app sampler: its own Vert.x periodic; `Map<appName, ConcurrentLinkedQueue<AppSample>>`;
  dead apps pruned via `keySet().retainAll(liveApps)`; per-app try/catch so one bad app cannot
  kill the tick.
- **INVARIANT: the sampler's reads are blocking DB calls, so they run off the event loop via
  `getVertx().executeBlocking(() -> { ... }, true)` (ordered, so a slow sample never overlaps
  the next); mirrors `sendWebRTCClientStats`. Do NOT revert to a bare
  `setPeriodic(l -> sampleAppMetrics())`; that blocks the event loop.**
- `viewers` = `DataStore.getTotalViewersCount()`: WebRTC + HLS + DASH summed over the app's
  broadcasts. Implemented across `InMemoryDataStore` / `MapBasedDataStore` / `MongoStore`
  (Mongo reuses the proven single-accumulator aggregation three times, not a multi-field
  `$group`); the three-field sum is deduped into `protected static DataStore.totalViewers(Broadcast)`.
  `streams` = the existing `getActiveBroadcastCount()`.
- **Why the shared DataStore, not in-process beans:** each AMS app owns its own DataStore, so
  "per-app" is free; edges atomically `inc` the shared broadcast record's viewer counts, so
  reading the store yields cluster-wide totals with zero cross-node calls, and the same path
  works standalone and clustered. Every node samples redundantly (harmless). The one assumption
  still to verify on a real cluster: HLS/DASH counts are `inc`-summed across edges, not
  last-writer-wins (TODO.md).
- Config: `server.app_metrics_history_sample_period_ms` (30000) +
  `server.app_metrics_history_size` (1440, about 12h).
- `viewers` depends on `writeStatsToDatastore` (default on; off means 0; must stay on in
  cluster mode). Frontend handling: see [dashboard-widgets.md](dashboard-widgets.md) section 4.
- No `health` series: AMS has no per-app health metric; the UI renders a placeholder slot.

## `GET /broadcasts/{id}/metrics-history` (per-stream)

- Push-fed, no sampler: `AntMediaApplicationAdapter.setQualityParameters` already fires per
  stream roughly every 10s (`MuxAdaptor.STAT_UPDATE_PERIOD_MS`) with fresh publish stats +
  viewer counts; it tees one sample into a `StatsCollector` ring
  `Map<app, Map<streamId, StreamHistory>>` (nested under the per-app map so the existing
  `retainAll(liveApps)` tick reaps dead apps for free).
- Series: `bitrate, viewers (WebRTC+HLS+DASH), speed, encoderQueueSize, droppedPackets,
  droppedFrames, packetLostRatio`.
- **Bitrate is real instantaneous**, computed inside `StreamHistory.append` from the
  `totalByteReceived` delta over the actual wall-clock gap (`byteDelta*8*1000/msDelta`).
  First sample seeds the baseline (bitrate 0); a counter reset (negative delta) or a
  zero/negative gap clamps to 0. The broadcast record's own `bitrate` field is
  average-since-start and is deliberately not used.
- Cleanup: deterministic `removeStreamHistory(app, streamId)` at the TOP of `closeBroadcast`
  (runs for zombi and normal closes), plus the `retainAll(liveApps)` safety net.
- Config: `server.stream_metrics_history_size` (720, about 2h at the 10s cadence; roughly 24MB
  at 500 concurrent streams). A value of 0 or less disables collection (guard in
  `addStreamSample`). No period knob; it is push-driven.
- Returns a typed POJO `io.antmedia.statistic.type.StreamMetricsHistory` (parallel arrays,
  Jackson). NOT gson `JsonObject` like the console history endpoints: the app-scoped REST
  serializes via Jackson and `JsonObject` serialization is not guaranteed there.
- Thread-safety: per-stream single writer (one ingest thread); the ring is a
  `ConcurrentLinkedQueue`; `snapshot()` copies into a list for a stable read; baseline fields
  are plain (single-writer).
- `IStatsCollector` carries `addStreamSample` / `removeStreamHistory` /
  `getStreamMetricsHistory`. The adapter reaches it via `getStatsCollector()`; the REST shim via
  `getApplication().getStatsCollector()`.

## `PUT /cluster/node/{id}/note`

- Community `ClusterNode` carries a `note` field; `serialVersionUID` stays `1L`, which is the
  upgrade-safety guarantee (old Mongo docs / Redis blobs deserialize with `note=null`, no
  corruption).
- `IClusterStore.updateClusterNodeNote(id, note)` (community interface). Impls: enterprise
  `ClusterStore` (delegate), `MongoDBClusterStore` (field-scoped
  `UpdateOperators.set("note", ...)`; success via `getMatchedCount()==1` so re-saving the same
  note still succeeds), `RedisClusterStore` (get-mutate-put with a null check, so no phantom
  rows).
- Validation: `MAX_NODE_NOTE_LENGTH=500`, trimmed, null-safe; standalone (null cluster store)
  returns `Result(false, ...)`; unknown id returns `Result{success:false}`.
- **Heartbeat-safe by construction:** every node's 5s `addOrUpdate(localNode)` routes to
  `updateNode(nodeId)`, which reconstructs cpu/mem locally and never writes the caller's node
  object, so the stored note survives every heartbeat and node restart (node id =
  `MD5(MAC)+hostAddress`, stable).
- Mongo is race-free (field-scoped `$set`). Redis has a tiny self-healing cross-JVM
  note-vs-heartbeat window (get-mutate-put); accepted, since Redis is AMS-flagged
  non-recommended for cluster. An atomic `compute` is the hardening if it ever matters.
- Frontend sends the note as a query param and honors `Result.success` on save (the backend can
  return `success:false` on node-not-found). The mock is kept for offline dev.
