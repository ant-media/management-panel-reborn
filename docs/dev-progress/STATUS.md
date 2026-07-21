# Status

The single source of truth for where the panel stands. Open work lives in [TODO.md](TODO.md).

**Project:** ground-up rewrite of the AMS admin panel, replacing the legacy Angular console
(`Ant-Media-Management-Console`). Frontend + docs live in this repo. The backend analytics work
lives in Ant-Media-Server + Ant-Media-Enterprise, on the `feature/management-panel-analytics`
branch in both (as of 2026-07-07).

## Where things stand

- **Frontend: feature-complete for V1.** Every page is live against the real REST surface, with
  a mock transport for offline dev: dashboard, apps + app detail (Live Streams / VoD / Settings),
  cluster, server settings (Server / TLS / Users), logs, support, auth. Builds clean.
- **Backend analytics: complete, verification open.** Five endpoints shipped (table below).
  Cluster verification and unit tests are the open debt; see [TODO.md](TODO.md).
- **Stream Import/Export shipped** (pulled from V2). Definition-only JSON export + bulk import
  via a new `POST /broadcasts/create-list` endpoint (backend method + unit test in
  `BroadcastRestService`). Design: [features/streams-import-export.md](../features/streams-import-export.md);
  wire contract: [API.md](../API.md).
- **App Settings Import/Export shipped.** Frontend-only, no wire change: import replaces the
  draft through a preview modal, changes land as dirty marks for review before Save. Shipped
  alongside `parseFieldValue`, the single value interpreter that killed the phantom "unsaved"
  marks (server tab still pending, see [TODO.md](TODO.md) BUGS). Design:
  [features/app-settings.md](../features/app-settings.md).
- **Playlist VoD picker shipped.** New-stream playlist items: as-you-type VoD suggestions,
  a multi-select picker modal (search + thumbnails + pagination), drag-reorder rows. Picks
  insert the VoD's playable URL, plus an infinite-expiry play JWT on `playJwtControlEnabled`
  apps (seam: `vodPlaylistUrl` in `features/vods/url-builder.ts`). The editor
  (`streams/editor/playlist-items.tsx`) is shared by the new-stream and edit-stream modals; the URL
  contract lives in [RISKS.md](../RISKS.md).
- **Embedded player shipped, verified standalone for live streams** (including play-JWT gated
  apps). Live streams and VoD play in-panel, in a modal iframe of the app's own `play.html` (no
  player dependency); `usePlayUrl` / `useVodPlayUrl` mint a play token when the app gates
  playback. The VoD path still needs a live check (TODO.md). Design:
  [features/streams-master-detail.md](../features/streams-master-detail.md); token caveats:
  [RISKS.md](../RISKS.md).
- **Stream start/stop shipped, verified standalone.** One resolver (`streamAction` in
  `stream-actions.ts`) decides the action for a stream, and the row button, the `⋯` menu and the
  drawer all read it, so they cannot disagree. Server-pulled sources and playlists start/stop; a
  publisher is never plain-stopped, only force-stopped behind a confirm. The drawer grew an action
  bar (Play / Start-Stop / Edit / Delete as tiles) and its header is identity only.
- **Legacy stream parity complete: the edit modal shipped.** Type-aware edit from the drawer tile and
  the `⋯` menu, sending a dirty-only patch. Everything that writes a stream definition lives in
  `streams/editor/`, over one pure draft model (`editor/draft.ts`) shared by both modals and checkable
  outside React. The backend has three silent traps on this path, all in [RISKS.md](../RISKS.md).
  Verified standalone for publisher edits, the live `streamSource` restart flow, and viewer-limit
  semantics; the ipCamera and Mongo checks are open (TODO.md). Design:
  [features/streams-master-detail.md](../features/streams-master-detail.md).
- **Manual-test-round fixes are in code, pending a live pass** (TODO.md "Recent UI fixes"): modal
  height caps (header/footer pinned on short windows), playlist drag-reorder, viewer totals
  (RTMP excluded from the sum), a three-way speed label, dashboard app-row metrics polling, and
  tokenized in-panel VoD playback. Verified in the same round: confirm dialogs (app / VoD / user
  delete), node-note standalone behavior, per-stream metrics baseline + cleanup.
- **Legacy panel switcher implemented, live verification open.** Both panels ship in one AMS build: the
  old console keeps `/`, the new panel loads from `/reborn-panel/` (a folder in the same root webapp, so
  they share origin + session), and the old login chooses between them (classic default). The new panel
  reads the identity handoff on boot; the legacy side (chooser + handoff write + targeted logout) lives
  behind the `rebornSwitcher` build flag on `Ant-Media-Management-Console` `feature/reborn-panel-switcher`
  (off by default, pending merge to master as of 2026-07-21). `release.sh` here builds both and emits the
  content-only `panel-release-<ver>.zip`, validated end-to-end on node 22 and 24. Live checks and the
  backend `reborn-panel` name reservation are open (TODO.md). Design:
  [features/legacy-switcher.md](../features/legacy-switcher.md). After that, Phase 19 (cluster origin/edge
  analytics) and the rest of V1.

## Backend analytics endpoints

Design + invariants: [features/backend-analytics.md](../features/backend-analytics.md).
Wire contracts: [API.md](../API.md).

| Endpoint | State | Verified |
| --- | --- | --- |
| `GET /system-resources/history` | complete | standalone yes; cluster no |
| `GET /network-status` (+ `netOut`/`netIn` series) | complete | standalone yes; cluster no; reads zero in containers (V2) |
| `GET /applications/{name}/metrics-history` | complete | standalone yes; cluster no; no unit tests |
| `PUT /cluster/node/{id}/note` | complete, backend + frontend | standalone yes (heartbeat + restart survival); Redis + cluster no; no unit tests |
| `GET /broadcasts/{id}/metrics-history` (per-stream) | complete, in-memory | standalone yes; cluster no; no unit tests |

## Phase map

Phase numbers are the project's shorthand. Everything is complete unless marked.

| Phase | What | State |
| --- | --- | --- |
| 0-3 | Scaffold, primitives, chrome, theme switcher | complete |
| 4-5 | API client + auth shell | complete |
| 6-7 | Dashboard + applications | complete |
| 8 | App › Live Streams (+ create modal, all four stream types) | complete |
| 9 | Stream detail drawer + master-detail split | complete |
| 10 | App › VoD | complete |
| 11 | App › Settings editor | complete (11-a advanced-field UX parked; TODO.md) |
| 12 | Server settings / TLS / Users | complete |
| 13 | Server logs | complete |
| 14 | Cluster view | complete |
| 2.5 (A0-A5) | API layer rework: `endpoints/` catalog, mocks, client-side app-JWT mint | complete |
| C | Backend analytics endpoints (table above) | complete; verification open |
| 15 | Event log + notifications (panel ships a "coming soon" placeholder) | V2 |
| 16 | Per-stream metrics history | complete; verification open |
| 17 | retired; folded into Phase C per-app metrics | n/a |
| 18 | NOC / wallboard mode | V2 |
| 19 | Cluster origin/edge analytics | NOT STARTED |
| 20 | Legacy panel switcher (ship next to the old console, chooser on the legacy login) | implemented; live verification + backend name reservation open |
