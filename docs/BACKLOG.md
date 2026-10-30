# Backlog

Future scope. Never pull an item from here into active work without explicit approval. Open work is
in [TODO.md](TODO.md).

## Features

- **Phase 15: event log + notifications.** A server-wide persisted event store + query endpoint
  (mirror the per-stream `GET /broadcasts/{id}/connection-events/{offset}/{size}` pattern),
  then wire the Notifications panel to it with filters + deep-link routing. Nothing ships
  today: the designed panel stays in the tree unimported (`components/chrome/notifications.tsx`),
  its own header lists the two call sites to restore. Lowest priority.
- **Phase 18: NOC / wallboard mode.** A glanceable big-screen view of the dashboard for an
  unattended ops monitor, built on the per-stream/per-app history data; frontend-only.
  Expansions once built: auto-rotating slides, multi-monitor, TV cast mode.
- **Command palette (Cmd/Ctrl+K)** as primary nav; sidebar stays.
- **Cross-app "all streams" table** (+ optional global-view secondary nav). Kept out of the current panel: a
  flat global table needs a per-app `list` fan-out every poll, O(apps) (see RISKS.md). Needs
  durable per-app aggregates or a combined backend query first. When it lands, reuse the shared
  table primitives (`useRangeSelection`, `Pagination`, `SortableTh`, `ActionMenu`) so behavior
  matches the per-app table.
- **Playlist item Start Offset (`seekTimeInMs`) UI.** The value round-trips losslessly through
  `PlaylistDraftItem` (an offset set in the old console survives an edit here) but there is
  no field to edit it, in either the new-stream or the edit modal. The legacy console took `HH:MM:SS`
  and converted. Pairs with per-item name editing.
- **Stream drawer, remaining gaps vs the prototype:** live preview/player (net-new); a
  connection-events feed (buildable today: the per-stream endpoint exists and
  `broadcasts(app).connectionEvents()` is already in the layer); health trend charts (the
  speed/drops/loss series are already in the ring, just not charted); a chart range selector
  (client-side slice of the ring); pop-out to its own window; FPS (no `fps` field on
  `Broadcast`, needs backend). Locked design notes: the prototype's collapsible
  Overview/Quality/Viewers sections were deliberately replaced by the tiles + shared-chart
  design, and per-protocol viewer *history* was deliberately dropped (Viewers is a single total
  line with a current-value protocol breakdown beneath); do not "restore" either.
- **Inline mini-graphs in stream rows** (bitrate sparkline / viewer trace per row). Feasible now
  that per-stream history exists; risk: too much info in the table.
- **Server settings import/export.** Same idea as the shipped app-settings version, but for the
  Server / TLS / Users tabs. Trickier than the app case: no JSON drawer there, and the payload
  mixes concerns (TLS paths and users don't transfer between machines), so it needs an
  allow-list decision first.
- **Support bundle.** One click downloads a zip of everything support asks for: logs, server +
  app settings, system/version info. Needs a backend endpoint that assembles the zip
  (client-side can't reach config files). There is no Support page, so this brings its own page,
  route and sidebar row (build on `StubPage`/`Page` per ui-kit.md); `support.request` is already in
  the layer. In cluster mode ideally covers all nodes (pairs with the per-node log proxy below).
- **Dashboard snapshot for issue reporting.** Capture current dashboard state (rendered image
  or a JSON dump of the metrics) to attach to a bug report. Pairs with the support bundle.
- **Subscriber + token management** (per-stream tokens, JWT, TOTP, subscriber CRUD/block)
  behind a "Security" tab on stream detail. The endpoint methods exist in the layer, unwired.
- **Copy SRT publish URL.** The panel only offers the RTMP publish URL to copy today; add the SRT
  publish URL alongside it (same spot, second copy action).
- **New-stream modal, deferred options:** the **edit** modal now ships the `autoStartStopEnabled`
  toggle (viewer-presence start/stop for pulled sources) and playlist scheduling
  (`plannedStartDate`); the create modal still has neither, so add them there for symmetry. Also
  per-camera profile selection (`ipcamera(app).deviceProfiles` exists).
- **VoD:** multi-file/queued upload; a real upload progress bar (needs an XHR transport path,
  `fetch` cannot report upload progress); resumable/chunked upload for very large files;
  unlink-directory UI (`DELETE /vods/directory` exists, no UI); an in-panel VoD detail/preview
  (player, `previewFilePath` thumbnail, metadata edit, linked-stream jump) mirroring the stream
  drawer, aka "better VoD exploration UX".
- **Cluster:** per-node logs (needs a backend per-node log proxy; the frontend `LogSource` seam
  in `features/logs/log-sources.ts` is ready); node delete gated to dead/stale rows
  (`DELETE /cluster/node/{id}` exists); real per-node streams/viewers/GPU (mock-projected
  today; the heartbeat must grow the fields, zero UI change); per-node trend sparklines on the
  dashboard cluster card (needs a per-node history endpoint keyed by node id, same shape as
  `system-resources/history`); the dense-table idiom when node counts get large; a full
  origin/edge topology view beyond Phase 19; open a node's own panel from its card (link to
  `http://<ip>:5080`, cheap but each node has its own login).
- **Per-app metrics follow-ups:** serve a `health` series and restore the app row's third chart.
  Inputs already reach `StatsCollector` ([dashboard-widgets.md](features/dashboard-widgets.md) §4),
  so this is aggregation, not collection. Open call: derive in `addStreamSample` (no DB reads, but
  node-local, it is the ingest path) or in `sampleAppMetrics()` (cluster-correct, needs an
  active-broadcast read per tick plus a `getActiveBroadcastList` on `MongoStore`). Either way the
  thresholds duplicate into Java; add a RISKS.md rule. Also: RTMP viewers in the totals; "sample on
  one node only" in cluster.
- **Per-stream metrics follow-ups:** add `jitterMs` / `rttMs` series to the ring (already on
  the broadcast record).
- **GPU temperature:** add NVML `nvmlDeviceGetTemperature` to `StatsCollector`; the GPU card
  currently shows the real memory-utilization % where the prototype showed temperature.
- **Network throughput in containers:** Docker `eth0` is a veth with no
  `/sys/class/net/<if>/device`, so a containerized AMS reports zero. Fallback: sum non-`lo`
  interfaces when no physical iface is found, or a configurable iface setting. Code-commented
  at `readPhysicalNetworkTotals` in `StatsCollector.java`.
- **Per-app user scoping UI:** the `User.appNameUserType` map (scope to role) is preserved on
  the wire today but not editable; add a per-user app-role matrix when multi-app teams need it.
- **TLS cert introspection + ACME:** blocked on a backend cert read endpoint
  (`/ssl-settings` is write-only); then show the active cert above the configure form.
- **User MFA / last-login / manual unblock:** none exist on the `User` model;
  `users/{email}/blocked` is read-only. All need backend first.
- **Backend gaps** (API-level list with mock swap points: [API.md](API.md) "Does NOT exist
  yet"): settings-descriptor API (replaces the frontend `settings-schema.ts` const via the
  `getSettingsSchema()` seam); `GET /ssl-settings` read-back; a server-side app-JWT mint for
  admins (removes the client-side secret exposure, see RISKS.md); the per-node log proxy;
  an SSE/WebSocket live-update transport.
- **Plugins GUI** and a **dashboard news/updates feed** (inherited from the old console's
  wishlist).
- **More cluster stuff** Add option to easily play using edge URLs? If that's even possible

## Polish

- **JSON drawer: flash the changed key.** When a setting is edited while the JSON drawer is
  open, briefly highlight the corresponding key in the JSON view.

## Open questions (decide when the work starts)

- SSE vs WebSocket for live updates.
- Long-term metric storage (pairs with the parked "durable time-series store" item in TODO.md):
  embedded TSDB, Timescale, or snapshotting the in-memory rings.
