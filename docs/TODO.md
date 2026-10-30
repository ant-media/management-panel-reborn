# TODO

Open work and known bugs. Future scope is in [BACKLOG.md](BACKLOG.md). Rules for this file:
[AGENTS.md](../AGENTS.md) *Docs*.

## Build

- [ ] **Backend: reserve the `reborn-panel` app name.** An app with that name registers a Tomcat context
  at `/reborn-panel` that shadows the panel folder and 404s it.

- [ ] **Generic error surface for unhandled API errors.** Every unexpected/unhandled error off the
  API should surface in one place, elegant and non-annoying, never a wall of raw failures. Handle the
  edge cases: coalesce a burst (20 errors in a short window collapses into one, not twenty); while the
  server is disconnected, suppress these errors entirely; and after a reconnect give a grace window
  (about 5s) before showing anything again, so a reconnect does not flush a backlog at the user.

- [ ] **VoD drag-and-drop upload.** Dragging an external file anywhere over the VoD list shows a
  "drop to upload" overlay and opens the upload modal with that file already linked.
- [ ] **Stream drawer: show the description.** The stream description is not visible anywhere in the
  drawer. Design first, then build.

- [ ] **Phase 19: cluster origin/edge analytics.** Mark the origin node per stream, per-edge viewer
  counts. Backend + frontend; needs a design talk on the endpoint before implementing. Related open
  call to settle here: per-stream history is written by the origin node, so decide whether reads on
  other nodes need routing or can return empty.
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

## Missing compatibility

Parity gaps: what the legacy console shows that the new panel does not yet.

- [ ] **Extradata field in the stream view.** The legacy console surfaces a stream's extradata
  (Broadcast `extraData`); the new panel does not. For playlists it renders the playlist duration,
  e.g. `Playlist Length: 00:21:28`. Research what else that field carries for other stream types,
  then parse and present it properly instead of dumping the raw value.

## Tests to write

- [ ] **Per-app metrics:** the `StatsCollector` sampler tick;
  `DataStore.getTotalViewersCount()` across `InMemoryDataStore` / `MapBasedDataStore` /
  `MongoStore`; the REST shim. (Ring lifecycle, seed on scope create and drop on scope remove,
  is covered in `StatsCollectorTest`.)
- [ ] **Per-stream metrics:** bitrate derivation (first-sample baseline,
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
  It also unlocks backlog follow-ups (health series, RTMP viewers, single-node cluster sampling).
  Storage choice (embedded TSDB? Timescale? snapshot files?) is an open design call.
- [ ] **Phase 11-a: App › Settings advanced fields.** Surface/hide the `advanced:true` fields,
  plus field-level validation / cross-field relationships. The schema already carries the
  flags; everything renders inline today, which is acceptable. Polish, not a blocker.
- [ ] **Lint cleanup: `react-hooks/set-state-in-effect`, one uniform app-wide pass as its own
  task** (the standing `pnpm lint` baseline, 16 errors; behavior is correct everywhere, so do
  not fix per-file). Two flavors:
  - data-to-draft sync (`use-applications.tsx`, `settings-tab.tsx`, `server-tab.tsx`): fix with
    render-phase reconciliation (track prev, reset the draft when data changes).
  - reset-form-on-open (`editor/new-stream-modal.tsx`, `upload-vod-modal.tsx`, `import-directory-modal.tsx`,
    `new-app-modal.tsx`): the parent keeps the modal mounted and toggles `open`, so form state
    persists across open/close and needs an explicit reset effect. The fix is **mount = open**:
    render the modal conditionally so it remounts fresh, and delete the effect. `ConfirmModal`
    already works this way, which is what removed the confirm modals from this list. Do the form
    modals together for consistency.

## Bugs

Confirmed defects, not new scope. Pick up independently.

- **Phantom "unsaved" marks in Server Settings** (`server-tab.tsx`). Dirty is strict stringify
  equality, but controls render/emit `draft[k] ?? def`, so an absent/`null` wire value sticks
  "unsaved" once touched while looking unchanged. App Settings shipped the fix:
  `parseFieldValue`/`canonValue` in `settings-schema.ts` wired through `canonEq` in
  `settings-tab.tsx`. Port the same pattern here; verify the server tab's field shapes first.
- **Edit/new stream modal: two scrollbars on short windows.** Likely the form's own
  `max-h-[64vh] overflow-y-auto` cap nesting inside the Modal body's `overflow-y-auto`, so both
  scroll. Reconcile to one scroll container (`streams/editor/`).
