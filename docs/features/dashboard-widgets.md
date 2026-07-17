# Dashboard widgets: data sources & what's left to make them real

The dashboard ports the prototype's full layout. Some widgets run on **real** endpoints
today; some run on **placeholder** mocks behind a real-shaped endpoint so the swap is
zero-frontend-change. This is the map of which is which and the exact backend work each
placeholder needs. Demo note: every widget renders against the mock server (`VITE_USE_MOCKS=true`)
so a presentation looks complete out of the box.

Architecture rule in play: placeholder data lives in `src/lib/api/mocks/*` behind a real endpoint
shape; hooks just poll. See ARCHITECTURE.md *Placeholder data*.

---

> Tier-1 stat cards (CPU / DB query / Live streams) are clickable and expand the same shared
> `HistoryPanel` as the Tier-2 meters, one open at a time, rendered under the Tier-1 row.
> Same idiom as the stream-detail drawer.
>
> Tier-2 layout: three meters, **Disk** (single ring), **Memory** (dual-ring: system RAM outer · JVM heap inner), **Network** (dual-ring: egress outer · ingress inner, auto-scaled per ring). All three are real (Network is host-only; see §1).

## 1. Network bandwidth (Tier-2 dual-ring + history): ✅ REAL (host-only)

- **Shows:** egress/ingress Mbps (dual-ring). Each ring **auto-scales to its own recent peak** via a nice-number ladder (`niceMax` in `tier-cards.tsx`), not the NIC link, which would leave a 30 Mbps flow a dead sliver on a 1 Gbps card; up/down scale independently so both breathe. No value-driven colouring (rings hold fixed tints). Link speed stays as context text; history panel charts out/in.
- **Reads:** `GET /rest/v2/network-status` → `{ outboundMbps, inboundMbps, uplinkMbps }`, plus
  `netOut`/`netIn` series on `GET /rest/v2/system-resources/history`. **Both real** (mocks kept for offline dev in `src/lib/api/mocks/dashboard.ts`).
- **Backend reality:** `StatsCollector` derives throughput from cumulative NIC byte counters: sums `/sys/class/net/<if>/statistics/{rx,tx}_bytes` over *physical* interfaces (iface has a `/device` entry → skips `lo`/bridges/`veth`/`docker0`/bonds/vlans/tun-tap), takes the delta over `nanoTime()` elapsed, converts to Mbps (`Δbytes·8/1e6/sec`). Negative deltas clamp to 0; first sample seeds the baseline. **Unprivileged: no sudo, no new dep.**
- **`uplinkMbps`** = sum of each physical NIC's `/sys/class/net/<if>/speed` (best-effort; unreadable/`-1` on a down link → omitted). It's the *link* speed, not a provisioned cap; if operators want a provisioned ceiling instead, add a server setting later.
- **⚠️ Container caveat:** inside Docker, `eth0` is a `veth` with no `/device` entry → physical set is empty → reports **zero**: the ring reads `0 / 0` and the history panel says "Collecting samples…". Tracked in [TODO.md](../dev-progress/TODO.md) V2 ("Network throughput in containers"); decide fallback (sum non-`lo`, or configurable iface) when it comes up.
- **Seam note (two endpoints, one widget):** current values come from `/network-status`; the *history* rides on the shared `/system-resources/history` as `netOut`/`netIn`. Both feed off the same in-memory ring sampled in `StatsCollector`.

## 2. GPU (aggregate ring + per-device breakdown): ✅ REAL DATA

- **Shows:** average util ring + per-GPU util bar, memory used/total, memory-util %.
- **Reads:** `gpuUsageInfo` embedded in `GET /rest/v2/system-resources` (the dashboard already polls it).
  A dedicated `GET /rest/v2/gpu-status` exists too (same array). **This is a real backend surface**
  (`StatsCollector.getGPUInfoJSObject`).
- **Real wire fields:** `index, deviceName, gpuUtilization, memoryUtilization, encoderUtilization,
  decoderUtilization, memoryTotal, memoryFree, memoryUsed` (util 0-100 ints; memory in bytes).
- **Gap vs prototype:** the server reports **no temperature**. The prototype's `°C` readout is replaced
  by the real `memoryUtilization %`. Card hides itself when `gpuUsageInfo` is empty (no GPU / community build).
- **TODO:** none required; works against a real GPU node today. *Optional:* add NVML temperature
  (`nvmlDeviceGetTemperature`) to the backend to restore the temp readout. Note GPU here is the **panel-origin
  node only**; cluster-wide GPU is the cluster page's concern.

## 3. Cluster summary (per-node CPU/memory): ✅ REAL DATA, ⚠️ no trend sparklines

- **Shows:** per-node status dot + CPU% + Memory% meters, "N of M healthy" pill. Renders only when clustered.
- **Reads:** the same real endpoints as the Phase-14 cluster page via `useCluster()`
  (`GET /rest/v2/cluster-mode-status` + `GET /rest/v2/cluster/nodes/{offset}/{size}`). CPU/Mem are real.
- **Gap vs prototype:** the prototype drew per-node **trend sparklines**; there is no cluster per-node
  time-series, so current-value **meters** stand in (consistent with Phase-14's NodeCard).
- **TODO to restore sparklines:** a cluster per-node metric-history store/endpoint (the heartbeat carries
  only the latest sample). Same shape as `system-resources/history`, but keyed by node id.
  Also note per-node streams/viewers/GPU are mock-projected (see API.md "does NOT exist yet"); node **notes** are real (`PUT /cluster/node/{id}/note`).

## 4. Applications drilldown (expandable rows): ✅ REAL (viewers + streams), ⛔ health = TODO placeholder

- **Shows:** click a row → viewers / live-streams mini-charts ("last 12 hours") + a **stream-health placeholder** (TODO slot).
- **Reads:** row metadata (`liveStreamCount/vodCount/storage`) is **real** (`/applications-info`).
  The drilldown charts read `GET /rest/v2/applications/{name}/metrics-history` →
  `{ viewers, streams }`, **real** (`StatsCollector`); mock (`src/lib/api/mocks/applications.ts`) kept for offline dev.
- **Backend reality (StatsCollector in-memory ring):** a per-app sampler ticks every
  `server.app_metrics_history_sample_period_ms` (30s) into a per-app ring of `server.app_metrics_history_size` (1440)
  samples ≈ **12h**. Per tick it reads each app's **own DataStore**: `viewers` = `getTotalViewersCount()`
  (WebRTC+HLS+DASH summed over the app's broadcasts), `streams` = `getActiveBroadcastCount()`. Arrays oldest→newest.
- **Why this is cluster-correct for free:** viewer/stream counts live in the **shared** DataStore (edges `inc` the
  broadcast record), and each app owns its own store, so any node computes the **cluster-wide** per-app totals with
  no cross-node calls. In a cluster every node samples the same shared values (redundant but harmless).
- **`health` is not served**: AMS has no per-app health metric. The row renders a "TODO / Not collected yet"
  placeholder instead of a third chart. The frontend tolerates a partial response (missing series ⇒ no crash);
  states: error ⇒ "Trends unavailable", empty ring ⇒ "Collecting metrics…", else charts.

### Shortcomings / edge cases (per-app metrics-history)
- **In-memory only**: history is **lost on server restart** and rebuilds from empty (takes up to 12h to fill);
  the row shows "Collecting metrics…" until the ring has samples. Durable/persisted history is parked in [TODO.md](../dev-progress/TODO.md).
- **`writeStatsToDatastore` dependency**: `viewers` reads viewer counts from the DataStore, which are only written
  when `writeStatsToDatastore` is on (the **default**). If an operator disables it, **viewers read 0** (streams are
  unaffected). It **must** stay on in cluster mode (it's how viewers aggregate across nodes); noted at `AppSettings#writeStatsToDatastore`.
  **Handled on the frontend**: `app-row.tsx` reads the app's settings on expand and, when the flag is off,
  shows the shared `StatsDisabledNotice` in place of the viewers chart (streams unaffected), so the zero line is never
  mistaken for "no viewers". Same treatment in the stream-detail drawer's Viewers section (gated counts show a dash, RTMP
  stays live). Settings ride the console scope (session cookie); no app JWT involved. See [UI-KIT.md](../ui-kit.md).
- **`health` unimplemented**: placeholder slot. If defined later (e.g. % of live streams with status=broadcasting &&
  speed≈1.0), add a `health` series and swap the placeholder for a chart.
- **RTMP viewers excluded**: `getTotalViewersCount()` sums WebRTC+HLS+DASH only (the playback protocols the panel surfaces).
- **Cluster redundancy**: every node samples independently; fine at this cadence, but a future "sample on one node only"
  optimization would cut duplicate DataStore aggregations on large clusters.

---

## Demo toggles (mock server only)
- **GPU on/off:** `GPU_COUNT` in `src/lib/api/mocks/dashboard.ts` (set `0` to hide the GPU card).
- **Cluster on/off:** `IN_CLUSTER` in `src/lib/api/mocks/cluster.ts` (set `false` for the standalone, cluster-card-hidden state).
- Network and the app drilldown always render under mocks.

## One-line status
| Widget | Data today | Backend work to be real |
| --- | --- | --- |
| Network bandwidth | **real** (host-only) | container fallback (veth); see §1 caveat |
| GPU | **real** | none (optional: add temperature) |
| Cluster summary | **real** (meters) | per-node time-series to restore sparklines |
| App drilldown | **real** (viewers/streams, in-memory) | durable store; define `health`; per-app sampler is 12h/30s |
