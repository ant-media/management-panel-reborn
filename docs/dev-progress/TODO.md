# TODO

Open work only, split by release target. Current state lives in [STATUS.md](STATUS.md).

Rules:
- **V1 = the current panel.** Everything above the V2 line is agreed work.
- **V2 = future scope.** Nothing below the V2 line gets picked up without explicit approval.
- When something ships: delete its entry here, update STATUS.md, move lessons to
  [RISKS.md](../RISKS.md) and design notes to [features/](../features/README.md).

---

# V1 (current panel)

## Build

- [ ] **Legacy panel switcher. Current priority.** Ship the panel next to the old console in one AMS
  build: old console keeps `/`, the panel goes to `/reborn-panel/`, and the old login screen asks
  which one you want. Design + all the reasoning:
  [features/legacy-switcher.md](../features/legacy-switcher.md). In order:
  - [ ] **Panel, build.** `base: './'` in `vite.config.ts`, and point `redeploy.sh` at
    `$AMS_DIR/webapps/root/reborn-panel`. It must stop wiping `webapps/root`, the old console
    lives there.
  - [ ] **Panel, auth.** On boot, if the server says authenticated and there is no `ams.auth.user`,
    read `ams.legacy.auth.handoff` (`{email, message}`), run `toAuthUser` on it, save, drop the
    handoff key. Without this, everyone who logs in through the old door renders as a nobody: no
    admin, no scopes. Logout clears both keys and goes to `/`.
  - [ ] **Old console, login screen.** Two panel cards with a wireframe silhouette each, classic
    preselected every time, BETA badge on the new one. Picking the new card redirects to
    `/reborn-panel/` after a successful login instead of calling `router.navigateByUrl`.
  - [ ] **Old console, handoff.** Write `ams.legacy.auth.handoff = {email, message}` on every
    successful login (`message` = the raw string from the authenticate response). On every login, not
    just when the new panel is picked, or a bookmarked `/reborn-panel/` has no identity.
  - [ ] **Backend.** Reserve the `reborn-panel` app name. An app with that name shadows the
    panel's folder and makes it unreachable.
  - [ ] **LAST, only once everything above works.** The old login page calls `localStorage.clear()`
    on mount (`login.component.ts`), which wipes the whole origin: the panel's `ams.theme`, the
    handoff key, and the `{app}jwtToken` keys both panels share. Replace it with targeted
    `removeItem` calls.

- [ ] **Generic error surface for unhandled API errors.** Every unexpected/unhandled error off the
  API should surface in one place, elegant and non-annoying, never a wall of raw failures. Handle the
  edge cases: coalesce a burst (20 errors in a short window collapses into one, not twenty); while the
  server is disconnected, suppress these errors entirely; and after a reconnect give a grace window
  (about 5s) before showing anything again, so a reconnect does not flush a backlog at the user.

- [ ] **VoD drag-and-drop upload.** Dragging an external file anywhere over the VoD list shows a
  "drop to upload" overlay and opens the upload modal with that file already linked.
- [ ] **Delete action in the dashboard app row.** Customers expect it there. Reuses the existing
  app-delete confirm flow.
- [ ] **Stream drawer: show the description.** The stream description is not visible anywhere in the
  drawer. Design first, then build.

- [ ] **Phase 19: cluster origin/edge analytics.** Mark the origin node per stream, per-edge viewer
  counts. Backend + frontend; needs a design talk on the endpoint before implementing. Related open
  call to settle here: per-stream history is written by the origin node, so decide routing for
  non-origin reads (see Verify below).
- [ ] **Settings rules for the cross-field claims the schema only states in prose.** `FieldRule`
  exists (`settings-schema.ts`); `hlsMuxingEnabled` and `webMMuxingEnabled` ship. Still
  unenforced: `mp4MuxingEnabled` needs `h264Enabled`; `s3RecordingEnabled` needs a bucket + keys.
  Trace the reader in `AppSettings.java` / the muxers before wording each message, and drop any
  that can't be proven. The WebM claim looked like "needs VP8" and is really "needs VP8 **or**
  AV1", so a rule written from the hint alone would have fired on every AV1-only app.
- [ ] **Negative log filter.** Log search only matches positively. Add an exclude term ("hide
  lines containing X") beside the search input. Client-side like search: both filters live in
  the `entries.filter` memo in `logs/page.tsx`, so this is toolbar + one predicate.
- [ ] **Full log file download.** The Download button saves only the loaded buffer (10k lines
  max). The backend serves the log in 500KB slices (`/log-file`), so a real download needs
  either a loop over slices or a new direct-download endpoint (better for GB-size logs). Wire
  into `onDownload` in `logs/page.tsx`.
- [ ] **Documentation links in the UI.** No links to antmedia.io docs anywhere today. Add doc
  deep-links where AMS-specific terms need explaining: extend the settings schema `info` field
  with an optional URL (renders as a "Learn more" in the info tooltip), plus page-level links
  where a feature has a docs page. Keep it light, no link farms.
- [ ] **Copy app settings on create.** New-app modal grows an optional "copy settings from"
  select over the existing app list (already in scope from `useApplications()`); after create
  succeeds, `getSettings` on the source, strip `appName`, `saveAppSettings` on the new app.
  Reuse the `appName`-strip rule from `settings-io.ts` (shipped with settings import/export).

## Verify on a live server

Standalone state per endpoint is in [STATUS.md](STATUS.md). Cluster is unverified across the
board. Backend design + invariants:
[features/backend-analytics.md](../features/backend-analytics.md).

### Recent UI fixes (in code, not yet checked on a live server)

- [ ] Dashboard app row: "Collecting metrics" clears on its own shortly after the first sample,
  and the graphs advance while the row stays expanded (history polls at 15s while open).
- [ ] Embedded player: Escape closes the modal even after clicking inside the iframe; in
  fullscreen the first Escape only exits fullscreen.
- [ ] Tall modals (player, VoD picker) on a short window: header and footer stay pinned, only the
  body scrolls, the 16:9 video letterboxes to fit.
- [ ] Playlist editor: drag a row by its grip; the list reorders and persists on save (new-stream
  and edit modals share the component).
- [ ] Stream card + drawer: total viewers is WebRTC + HLS + DASH (RTMP is not counted; a
  per-protocol `-1` clamps to 0) and matches the graph.
- [ ] Speed pill hover: a stream encoding faster than realtime reads "above realtime speed"
  (three-way label, tolerance band around 1.0).
- [ ] VoD Play on a play-JWT app: opens the in-panel player and a gated VoD plays; ungated still
  plays; open-in-new-tab in the header works.

### Legacy panel switcher

Design: [features/legacy-switcher.md](../features/legacy-switcher.md). Everything here needs the
panel actually deployed into `webapps/root/reborn-panel`, next to a real console build.

- [ ] Assets load from the subfolder (relative base), hash routes work, and a hard refresh on a deep
  route still comes back to the same page.
- [ ] Admin picks classic: the old panel behaves exactly as before, nothing changed.
- [ ] Admin picks the new panel: lands already logged in, and renders **as an admin**. Not "Unknown
  user", not "App user". This is the handoff working.
- [ ] App-scoped (non-admin) user picks the new panel: only their app is visible, admin actions hidden.
- [ ] Open `/reborn-panel/` directly with a session created by the legacy login: identity still
  resolves, because the handoff is written on every login.
- [ ] Logout from the new panel: lands on `/` with the chooser, and the session is really dead (the
  old panel does not let you straight back in).
- [ ] Per-app REST from the subfolder: streams and VoD load, VoD upload round-trips, bulk delete and
  `create-list` reach the app, a JWT-protected app still mints and retries. Same proxy checks as the
  root deploy below, now from the new path.

### Cluster (all analytics endpoints)

- [ ] **The load-bearing assumption:** per-broadcast HLS/DASH viewer counts in the shared
  DataStore are `inc`-summed across edges (not last-writer-wins), so `getTotalViewersCount()`
  on any node returns the cluster-wide total. Drive viewers on 2+ edges, read from origin and
  an edge, expect them to agree and to be the sum.
- [ ] `system-resources/history` + `network-status` in a multi-node setup.
- [ ] Per-stream history in cluster: quality samples are written by the origin node. Confirm
  reading from the origin works; decide whether non-origin reads need routing (Phase 19) or
  empty-is-fine.
- [ ] `writeStatsToDatastore` stays ON in cluster mode (it is how viewers aggregate across
  edges).
- [ ] Per-app sampler stays off the event loop under load (`executeBlocking`, ordered: a slow
  sample must not overlap the next).
- [ ] Restart: rings are in-memory, so after a restart the panel shows "Collecting metrics"
  states and rebuilds from empty.

### Node note

Standalone is verified (round-trip, clear, length cap, heartbeat + restart survival, unknown id
rejected). Remaining:

- [ ] Redis store: repeat the heartbeat-survival check (Mongo is field-scoped and race-free;
  Redis is get-mutate-put with a small self-healing race window).

### Per-stream metrics edge cases

The first-sample zero baseline and ring cleanup (stream stop + app undeploy) are verified.
Remaining:

- [ ] A publisher reconnect (byte-counter reset) must not produce a negative or huge bitrate.
- [ ] `writeStatsToDatastore` OFF: the `viewers` series reads 0; bitrate/speed/queue/drops/loss
  are unaffected.
- [ ] `server.stream_metrics_history_size=0` disables collection (endpoint returns empty
  arrays).

### Stream edit modal

The draft model (`streams/editor/draft.ts`) is verified pure: dirty-only bodies, no runtime state, `ipCamera`
omits `streamUrl`, blank credentials are not sent, playlist seek offsets survive a reorder and a retyped
URL. On a live server, publisher edits while broadcasting, the live `streamSource` restart flow, and the
viewer-limit semantics (blank sends `-1`, `0` blocks Save) are verified. What remains needs an IP camera,
a playlist, or a Mongo-backed server. Semantics: [API.md](../API.md); traps: [RISKS.md](../RISKS.md).

- [ ] Live `ipCamera`: a **wrong password** must fail with the server's message, and the camera is left
  **stopped** (the backend aborts after the stop). Confirm the row shows it down and the error says so.
- [ ] `ipCamera`: the modal must never send `streamUrl`; confirm the server re-derives the RTSP URL from
  the host + credentials. Also check the ONVIF **Discover** button (legacy had it only on create).
- [ ] Playlist: reorder, add an item, set and clear the Schedule. Confirm a pre-existing item's
  `seekTimeInMs` survives the round-trip, and that a cleared schedule cancels the timer without starting
  the playlist.
- [ ] **Mongo:** confirm no phantom failures. A save always carries a real change, so `getModifiedCount()`
  should always be 1; the in-memory store can't reproduce this, so it needs a Mongo-backed server.

### Other

- [ ] **Panel deployed inside the server.** The only setup that exercises the backend proxy:
  `pnpm dev-live` against a same-host server cannot reproduce the IP filter ([RISKS.md](../RISKS.md)).
  The deploy target is `webapps/root/reborn-panel`, so this check lives in the switcher list
  above.

## Tests to write

- [ ] **Per-app metrics (Phase C):** the `StatsCollector` per-app sampler;
  `DataStore.getTotalViewersCount()` across `InMemoryDataStore` / `MapBasedDataStore` /
  `MongoStore`; the REST shim.
- [ ] **Per-stream metrics (Phase 16):** bitrate derivation (first-sample baseline,
  counter-reset clamp, zero-gap guard); ring eviction at the size cap; `removeStreamHistory` +
  the `retainAll(liveApps)` prune; the `BroadcastRestService` shim.
- [ ] **Node note:** `ClusterStoreTest` covering Mongo (`$set` is field-scoped,
  `getMatchedCount()==1` as the success signal, unknown id returns false) and Redis
  (get-mutate-put, unknown id returns false, note preserved across an `updateNode` heartbeat);
  `ClusterRestServiceV2` validation (500-char cap, null/empty note, standalone null-store
  guard).

## Parked (do not start without a design talk)

- [ ] **Durable time-series store (per-app + per-stream).** Both rings are in-memory: lost on
  restart, bounded window (per-app ~12h, per-stream ~2h). One durable store should serve both.
  It also unlocks V2 follow-ups (health series, RTMP viewers, single-node cluster sampling).
  Storage choice (embedded TSDB? Timescale? snapshot files?) is an open design call.
- [ ] **Phase 11-a: App › Settings advanced fields.** Surface/hide the `advanced:true` fields,
  plus field-level validation / cross-field relationships. The schema already carries the
  flags; everything renders inline today, which is acceptable. Polish, not a blocker.
- [ ] **Lint cleanup: `react-hooks/set-state-in-effect`, one uniform app-wide pass at the end
  of V1** (the standing `pnpm lint` baseline, 16 errors; behavior is correct everywhere, so do
  not fix per-file). Two flavors:
  - data-to-draft sync (`use-applications.tsx`, `settings-tab.tsx`, `server-tab.tsx`): fix with
    render-phase reconciliation (track prev, reset the draft when data changes).
  - reset-form-on-open (`editor/new-stream-modal.tsx`, `upload-vod-modal.tsx`, `import-directory-modal.tsx`,
    `new-app-modal.tsx`): the parent keeps the modal mounted and toggles `open`, so form state
    persists across open/close and needs an explicit reset effect. The fix is **mount = open**:
    render the modal conditionally so it remounts fresh, and delete the effect. `ConfirmModal`
    already works this way, which is what removed the confirm modals from this list. Do the form
    modals together for consistency.

---
---

> ## THE V2 LINE
> **Everything below is future scope. Do not pull a V2 item into active work without explicit
> approval.** When V2 planning starts, this section seeds it.

---
---

# V2 (future scope)

## Features

- **Phase 15: event log + notifications.** A server-wide persisted event store + query endpoint
  (mirror the per-stream `GET /broadcasts/{id}/connection-events/{offset}/{size}` pattern),
  then wire the Notifications panel to it with filters + deep-link routing. The panel today
  ships a designed "coming soon" placeholder (`components/chrome/notifications.tsx`, no faked
  data, no unread badge). Lowest priority.
- **Phase 18: NOC / wallboard mode.** A glanceable big-screen view of the dashboard for an
  unattended ops monitor, built on the per-stream/per-app history data; frontend-only.
  Expansions once built: auto-rotating slides, multi-monitor, TV cast mode.
- **Command palette (Cmd/Ctrl+K)** as primary nav; sidebar stays.
- **Cross-app "all streams" table** (+ optional global-view secondary nav). Removed from V1: a
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
- **Server settings import/export.** Same idea as the V1 app-settings version, but for the
  Server / TLS / Users tabs. Trickier than the app case: no JSON drawer there, and the payload
  mixes concerns (TLS paths and users don't transfer between machines), so it needs an
  allow-list decision first.
- **Support bundle.** One click downloads a zip of everything support asks for: logs, server +
  app settings, system/version info. Needs a backend endpoint that assembles the zip
  (client-side can't reach config files). Lives on the Support page, a placeholder card today;
  in cluster mode ideally covers all nodes (pairs with the per-node log proxy below).
- **Dashboard snapshot for issue reporting.** Capture current dashboard state (rendered image
  or a JSON dump of the metrics) to attach to a bug report. Pairs with the support bundle.
- **Subscriber + token management** (per-stream tokens, JWT, TOTP, subscriber CRUD/block)
  behind a "Security" tab on stream detail. The endpoint methods exist in the layer, unwired.
- **Copy SRT publish URL.** The panel only offers the RTMP publish URL to copy today; add the SRT
  publish URL alongside it (same spot, second copy action).
- **New-stream modal, deferred options:** the **edit** modal now ships the `autoStartStopEnabled`
  toggle (viewer-presence start/stop for pulled sources) and playlist scheduling
  (`plannedStartDate`); the create modal still has neither, so add them there for symmetry. Also
  ONVIF PTZ + per-camera profile selection (`ipcamera()` layer methods exist).
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
- **Per-app metrics follow-ups:** define + serve a `health` series (the UI placeholder slot
  exists); include RTMP viewers in the totals; a "sample on one node only" cluster
  optimization.
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
- **Backend gaps** (API-level list with mock swap points: [API.md](../API.md) "Does NOT exist
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
- Long-term metric storage (pairs with the V1 "durable time-series store" parked item):
  embedded TSDB, Timescale, or snapshotting the in-memory rings.

---
---

# BUGS

Confirmed defects, not new scope. Pick up independently.

- **Phantom "unsaved" marks in Server Settings** (`server-tab.tsx`). Dirty is strict stringify
  equality, but controls render/emit `draft[k] ?? def`, so an absent/`null` wire value sticks
  "unsaved" once touched while looking unchanged. App Settings shipped the fix:
  `parseFieldValue`/`canonValue` in `settings-schema.ts` wired through `canonEq` in
  `settings-tab.tsx`. Port the same pattern here; verify the server tab's field shapes first.
- **Edit/new stream modal: two scrollbars on short windows.** Likely the form's own
  `max-h-[64vh] overflow-y-auto` cap nesting inside the Modal body's `overflow-y-auto`, so both
  scroll. Reconcile to one scroll container (`streams/editor/`).
