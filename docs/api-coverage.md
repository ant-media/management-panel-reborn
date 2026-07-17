# API coverage matrix

Maps every `src/lib/api/endpoints/*` method to its REST endpoint, whether a mock exists, and who consumes it. Paths in the [API.md](API.md) reference; wire shapes in the API.md appendix.

**Status legend**
- **wired**: a hook/component calls it; has a mock (runs in mock mode).
- **layer**: method exists in `endpoints/`, no UI consumer yet (catalog method). Mostly no mock; add one when a feature surfaces it.
- **mock-only**: wired, but **no real backend**; the mock is a `TODO: BACKEND` stub (see [API.md "Does NOT exist yet"](API.md)).
- **catalog**: real endpoint, documented in API.md, **not in the layer**. Add to `endpoints/` only when needed.

**Mock**: ✓ has a `registerMock`, - none.

---

## Per-app: `/{app}/rest/v2`  (factories from `endpoints/`)

> Endpoints below are the **canonical** paths. On the wire `FetchTransport` tunnels every one of them through the backend proxy (`/rest/v2/request?_path=…`); apps refuse REST from anything but the server itself. See [ARCHITECTURE.md](ARCHITECTURE.md) *Backend proxy*.

### `broadcasts(app)`
| Method | Endpoint (`/broadcasts/…`) | Mock | Status | Consumer |
|---|---|---|---|---|
| `list` | `list/{o}/{s}` | ✓ | wired | `useBroadcasts` |
| `get` | `{id}` | ✓ | wired | `useStreamDetail` |
| `create` | `create` (POST, `?autoStart`) | ✓ | wired | `useBroadcastActions` (all 4 types) |
| `createMany` | `create-list` (POST, `?onDuplicate`) | ✓ | wired | `import-streams-modal` (bulk import) |
| `update` | `{id}` (PUT) | ✓ | wired | `edit-stream-modal` (dirty-only patch; see API.md for the merge + restart semantics) |
| `remove` | `{id}` (DELETE) | ✓ | wired | `useBroadcastActions` |
| `removeMany` | `?ids=` (DELETE) | ✓ | wired | `useBroadcastActions` |
| `count` | `count` · `count/{search}` | ✓ | wired | `useBroadcasts` |
| `activeLiveStreamCount` | `active-live-stream-count` | ✓ | wired | `useBroadcasts` |
| `start` / `stop` | `{id}/start` · `{id}/stop` (POST) | ✓ | wired | `useBroadcastActions` |
| `record` | `{id}/recording/{bool}` (PUT) | ✓ | wired | `useBroadcastActions` |
| `statistics` | `{id}/broadcast-statistics` | ✓ | wired | `useStreamDetail` |
| `webrtcClientStats` | `{id}/webrtc-client-stats/{o}/{s}` | ✓ | wired | `useStreamDetail` |
| `metricsHistory` | `{id}/metrics-history` | ✓ | **real** (StatsCollector per-stream ring; bitrate/viewers/speed/queue/drops/loss, ~2h) | `useStreamDetail` |
| `totalStatistics` | `total-broadcast-statistics` | - | layer | - |
| `streamInfo` | `{id}/stream-info` | - | layer | - |
| `connectionEvents` | `{id}/connection-events/{o}/{s}` | - | layer | - (Phase 15 building block) |
| `getToken` | `{id}/token` | - | wired | `usePlayUrl` (embedded player; fires only when `playTokenControlEnabled`, so no mock needed) |
| `getJwtToken` | `{id}/jwt-token` | - | wired | `vodPlaylistUrl` (playlist VoD picks) · `usePlayUrl` (embedded player); both fire only when `playJwtControlEnabled`, so no mock needed |
| `validateToken` | `validate-token` (POST) | - | layer | - |
| `listTokens` / `revokeTokens` | `{id}/tokens/list/{o}/{s}` · `{id}/tokens` (DELETE) | - | layer | - |

### `ipcamera(app)`
| Method | Endpoint (`/broadcasts/…`) | Mock | Status | Consumer |
|---|---|---|---|---|
| `onvifDevices` | `onvif-devices` | ✓ | wired | `new-stream-modal` (ONVIF "Discover") |
| `deviceProfiles` `move` `stopMove` `error` | `{id}/ip-camera/*` · `{id}/ip-camera-error` | - | layer | - (PTZ / camera detail, deferred) |

### `subscribers(app)` · `restream(app)` · `push(app)`
- `subscribers`: `list`, `add`, `totp`, `block`, `remove`, `removeAll`; **layer** (no UI yet, no mock)
- `restream`: `addEndpoint`, `removeEndpoint`; **wired + mock** (stream drawer "Re-streaming" section + the row ⋯ → Other → Restream Endpoints modal; both reuse `EndpointsSection`)
- `push`: `subscriberAuthToken`, `sendToSubscribers`, `sendToTopic`; **layer** (no UI yet, no mock)

### `vods(app)`
| Method | Endpoint (`/vods/…`) | Mock | Status | Consumer |
|---|---|---|---|---|
| `list` | `list/{o}/{s}` (+ optional exact `streamId` filter, vods-only) | ✓ | wired | `useVods` (VoDs tab + `VodPickerModal`), `useVodSuggestions` (playlist item type-ahead) |
| `count` | `count` · `count/{search}` | ✓ | wired | `useVods` |
| `remove` / `removeMany` | `{id}` · `?ids=` (DELETE) | ✓ | wired | `useVodActions` |
| `upload` | `create?name=` (multipart) | ✓ | wired | `useVodActions` |
| `importDirectory` | `directory` (POST) | ✓ | wired | `useVodActions` |
| `get` | `{id}` | - | layer | - |
| `removeDirectory` | `directory` (DELETE) | - | layer | - |

---

## Management: `/rest/v2`  (objects from `endpoints/`)

### `apps`
| Method | Endpoint | Mock | Status | Consumer |
|---|---|---|---|---|
| `info` | `applications-info` | ✓ | wired | `useApplications` |
| `create` | `applications/{name}` (POST default · PUT multipart WAR) | ✓ | wired (+ optional custom-WAR upload) | `useApplications` / new-app modal |
| `remove` | `applications/{name}` (DELETE) | ✓ | wired | `useApplications` |
| `getSettings` | `applications/settings/{name}` | ✓ | wired | `useAppSettings` (+ the flag readers in `use-app-settings.ts`: `useViewerStatsEnabled`, `usePlayJwtEnabled`) |
| `saveSettings` | `applications/settings/{name}` (POST) | ✓ | wired | `saveAppSettings` |
| `metricsHistory` | `applications/{name}/metrics-history` | ✓ | **real** (StatsCollector ring; viewers+streams; health not served) | `app-row` |
| `names` | `applications` | - | layer | - (UI uses `info`) |
| `reset` | `applications/{name}/reset` (POST) | - | layer | - |
| `liveStreams` | `applications/live-streams/{name}` | - | layer | - |

### `server`
| Method | Endpoint | Mock | Status | Consumer |
|---|---|---|---|---|
| `settings` / `saveSettings` | `server-settings` GET/POST | ✓ | wired | `useServerSettings` |
| `configureSsl` | `ssl-settings` (POST multipart) | ✓ | wired | `configureSsl` |
| `licenceStatus` | `licence-status` | ✓ | wired | `useDashboardData`, `server-tab` (**mock is populated; real can be empty**) |
| `lastLicenceStatus` | `last-licence-status` | - | layer | - |
| `enterpriseEdition` | `enterprise-edition` | ✓ | wired | `settings-tab` (rule context), `server-tab` (licence-key gate) |

### `users`  (auth *flow*, authenticate/initial/logout, lives in `lib/auth/api.ts`)
| Method | Endpoint | Mock | Status | Consumer |
|---|---|---|---|---|
| `list` | `user-list` | ✓ | wired | `useUsers` |
| `create` / `update` / `remove` | `users` POST/PUT · `users/{email}` DELETE | ✓ | wired | `addUser` / `editUser` / `removeUser` |
| `changePassword` | `users/password` (POST) | ✓ | wired | `changeMyPassword` |
| `authenticationStatus` / `firstLoginStatus` | `authentication-status` · `first-login-status` | ✓ | layer | (auth flow calls the paths via `probeBoot`) |
| `adminStatus` | `admin-status` | - | layer | - |

### `system`
| Method | Endpoint | Mock | Status | Consumer |
|---|---|---|---|---|
| `resources` | `system-resources` | ✓ | wired | `useDashboardData` |
| `version` | `version` | ✓ | wired | `useDashboardData`, `server-tab` |
| `resourcesHistory` | `system-resources/history` | ✓ | wired | `useDashboardData` (cpu/mem/disk/heap/db/live + netOut/netIn all real) |
| `networkStatus` | `network-status` | ✓ | wired | `useDashboardData` (real: physical-NIC throughput, host-only) |
| `cpu` | `cpu-status` | ✓ | wired | `ui-sink` demo |
| `systemMemory` `jvmMemory` `fileSystem` `liveClientsSize` `gpuStatus` | resp. per-metric paths | ✓ | layer | - (dashboard reads the umbrella `resources`) |
| `serverTime` `systemStatus` `threadDump` `threads` `heapDump` `gc` `liveness` `shutdownStatus` `shutdownProperly` | ops paths | - | layer | - |

### `cluster`
| Method | Endpoint | Mock | Status | Consumer |
|---|---|---|---|---|
| `modeStatus` | `cluster-mode-status` | ✓ | wired | `useCluster` |
| `nodes` | `cluster/nodes/{o}/{s}` | ✓ | wired | `useCluster` |
| `saveNote` | `cluster/node/{id}/note` (PUT) | ✓ | **real** (mock kept for offline dev) | `useCluster` |
| `nodeCount` | `cluster/node-count` | ✓ | layer | - (UI uses `nodes`) |
| `deleteNode` | `cluster/node/{id}` (DELETE) | - | layer | - |

### `logs` · `support`
- `logs.file` → `log-file/{o}/{c}?logType`: ✓ **wired** (`log-sources` → `useLogTail`)
- `support.request` → `support/request` (POST): no mock, **layer**

---

## Catalog: real endpoints NOT in the layer
Documented in API.md; add a method (and mock) when a feature needs them.

**Management:** `GET /users/{email}/blocked` · `GET /thread-dump-json`. (Custom-WAR create, `PUT /applications/{appName}` multipart, is **wired**; see the create row above.)

**Per-app:** `GET /broadcasts/duration` · `PUT /broadcasts/{id}/seek-time/{ms}` · `GET /broadcasts/webrtc-send-low-level-stats` · `…/webrtc-receive-low-level-stats` · `GET /{app}/rest/v2/version` (per-app edition). **Advanced/ENT:** subtracks (`POST|DELETE /{id}/subtrack`, `GET /{id}/subtracks/{o}/{s}`, `…/active-subtracks/{o}/{s}`, `…/active-subtracks-count`), `POST /playlists/{id}/next`, `POST /{id}/data`, `POST /{streamId}/id3`, `POST /{streamId}/sei`, `POST /{hls_filename}/hls-to-mp4`.

---

## Mock-only (TODO: BACKEND)
**None: every analytics endpoint is implemented** (`system-resources/history`, `network-status`, `applications/{name}/metrics-history`, `cluster/node/{id}/note`, per-stream `broadcasts/{id}/metrics-history`); their mocks are **kept for offline dev**. Verification + unit tests are open; see [TODO.md](dev-progress/TODO.md). Remaining backend gaps: [API.md "Does NOT exist yet"](API.md).
