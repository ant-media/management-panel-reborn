# Backend REST API: verified reference

Verified against a live **Enterprise 4.0.0-SNAPSHOT** server + the Java source (captured 2026-06-15). Use this to answer "does the backend already support X?" before designing anything new. Frozen response shapes live in the appendix at the bottom of this file. The panel's named-method ↔ endpoint ↔ mock map is [api-coverage.md](api-coverage.md).

## Conventions & gotchas

**Two surfaces, two clients:**
- **Management** `/rest/v2/...`: console scope, via `api` (`RestServiceV2`, `ClusterRestServiceV2`). Server stats, apps, users, settings, cluster.
- **Per-app** `/{app}/rest/v2/...`: via `appApi(app)` (`BroadcastRestService`, `VoDRestService`, `RootRestService`, `PushNotificationRestService`). Streams, VoD, tokens, subscribers, camera, restream, push.

**Per-app calls go through the backend proxy; management calls do not.** Every app IP-filters its own REST surface (`ipFilterEnabled` defaults **true**, `remoteAllowedCIDR` defaults **`127.0.0.1`**), so a browser calling `/{app}/rest/v2/...` directly gets `403 "Not allowed IP"`. The panel sends app calls to root's proxy servlet, `/rest/v2/request?_path={app}/rest/v2/...`, which re-issues them from the server itself. Management `/rest/v2/...` stays direct and **must**: `AuthenticationFilter` exempts `/users/authenticate`, `/authentication-status`, `/first-login-status` and `/users/initial` by exact outer URI, so a proxied login 403s. Same servlet the legacy console used. Frontend seam: [ARCHITECTURE.md](ARCHITECTURE.md) "Backend proxy".

**Auth.** Server-side session via HttpOnly cookie set by `/users/authenticate`; client sends `credentials:'include'`. There is no `GET /me`: the panel persists the parsed user client-side after login. Password is **MD5-hashed client-side** before posting (legacy contract; don't "fix"). Per-app JWT (`{app}jwtToken` in localStorage) is a *separate* realm, injected as `Authorization` on `appApi` calls and forwarded untouched through the proxy (AMS reserves `ProxyAuthorization` for the console so the two never collide), and the **management session grants zero access to a JWT-protected app** (it 403s; verified live). See [ARCHITECTURE.md](ARCHITECTURE.md) "App JWT" for how the panel mints the app token.

**No SSE / WebSocket**: every live view is HTTP polling.

**Easy-to-miss wire facts (verified against the live capture; these trip people up):**
- **Bulk delete is `DELETE /broadcasts/?ids=a,b,c`** (comma-separated query param on the collection path), **not** `/broadcasts/bulk`. Same for `/vods/`.
- **Count endpoints return `{ number: N }`**, not a bare integer. The api layer unwraps to `number`.
- **`GET /licence-status` can return an empty body.** The populated `Licence` is in `system-resources.license` and `last-licence-status`. Read license from there.
- **Cluster node endpoints HTTP 500 on a standalone server** (not `-1`/`[]`). Gate every `cluster/node*` call on `cluster-mode-status.success === true`.
- **`GET /log-file` 500s without `?logType=`.** Pass `logType=null` (server log) or `logType=error`. Returns `{ logContent }`, not a bare string.
- **List query params are snake_case:** `sort_by`, `order_by`, `search`, `type_by` (broadcasts only).

---

## Management API: `/rest/v2`

### Auth & users  (`RestServiceV2`)
- `POST /users/authenticate` · `POST /users/initial`: login / create first admin (MD5 password). *(in `lib/auth/api.ts`, not `endpoints/users`)*
- `DELETE /users/logout`
- `GET /authentication-status` · `GET /first-login-status` · `GET /admin-status` → `Result{success}`
- `GET /user-list` → `User[]`
- `POST /users` (create) · `PUT /users` (edit; **can't edit yourself**) · `DELETE /users/{email}`
- `POST /users/password`: change own password (`{email, password:old, newPassword}`)
- `GET /users/{email}/blocked` → failed-login lockout status (**read-only; no unblock endpoint**). *Catalog, not in layer.*
- **`User`**: `{ email, userType: ADMIN|USER|READ_ONLY, scope: "system"|<app>, appNameUserType: {scope→role}, firstName, lastName, fullName, picture }`. `password`/`newPassword` write-only, MD5'd. Panel uses the **system-scoped** model and sends both `scope`+`userType` and the `appNameUserType` map. No MFA / last-login fields exist.

### Server stats & ops  (`RestServiceV2`)
- `GET /system-resources`: the umbrella firehose (CPU + JVM + system/native mem + filesystem + GPU + db query time + live counts + uptime + `license`). The dashboard polls this one, not the per-metric endpoints. Shape: appendix below.
- `GET /system-resources/history` → `Record<HistoryKey, number[]>`: **real** (`StatsCollector` in-memory ring, sampled every `server.metrics_history_sample_period_ms`=5s, capped at `server.metrics_history_size`=60). Keys: `cpu` `mem` `disk` `heap` (0-100), `db` (ms), `live` (stream count), `netOut`/`netIn` (Mbps, physical-NIC throughput; host-only, zero in containers); arrays oldest→newest, local node only. Older servers 404 it.
- `GET /applications/{name}/metrics-history` → `{ viewers: number[]; streams: number[] }`: **real** (`StatsCollector` per-app in-memory ring, sampled every `server.app_metrics_history_sample_period_ms`=30s, capped at `server.app_metrics_history_size`=1440 ≈ 12h). `viewers` = WebRTC+HLS+DASH summed over the app's broadcasts (cluster-wide via the shared DataStore; **requires `writeStatsToDatastore`**=default-on, else 0), `streams` = active broadcast count. Arrays oldest→newest. No `health` (placeholder in UI). Older servers 404 it.
- Per-metric subsets: `GET /cpu-status` · `/system-memory-status` · `/jvm-memory-status` · `/file-system-status` · `/system-status` · `/live-clients-size` · `/server-time`
- `GET /gpu-status` → `GpuInfo[]`: **real** (`StatsCollector`), also embedded as `system-resources.gpuUsageInfo` (what the dashboard reads). Per device: `{ index, deviceName, gpuUtilization, memoryUtilization, encoderUtilization, decoderUtilization, memoryTotal, memoryUsed, memoryFree }`; util 0-100 ints, memory bytes, **no temperature**. `[]` on community / no NVIDIA GPU.
- `GET /version` → `{ versionName, versionType, buildNumber }`
- `GET /applications-info` → `{ name, liveStreamCount, vodCount, storage }[]`
- **Ops** *(catalog, not in layer):* `GET /thread-dump` · `/thread-dump-json` · `/threads` · `/heap-dump` · `/liveness` · `POST /system/gc` · `GET /shutdown-proper-status` · `GET /shutdown-properly`

### Applications  (`RestServiceV2`)
- `GET /applications` → `{ applications: string[] }`
- `POST /applications/{appName}` (`@Consumes` JSON): create with defaults. **Wired.**
- `PUT /applications/{appName}` (`@Consumes` multipart): create from an uploaded WAR (parts: `file` = bytes, `file_info` = filename; custom apps are `.war`, not `.jar`). **Wired** (new-app modal, optional custom-WAR picker).
- `DELETE /applications/{appName}?deleteDB={bool}`
- `POST /applications/{appName}/reset`
- `GET /applications/live-streams/{appName}`
- `GET /applications/settings/{appName}` · `POST /applications/settings/{appName}`
  - Flat `AppSettings` POJO (~160 fields, no grouping). **Save POSTs the whole object back**: the editor merges edits onto the fetched POJO so untouched fields aren't wiped. `jwtSecretKey` lives here (the client-side app-JWT mint reads it).
- App name must match `^[A-Za-z0-9_-]{1,32}$` (Java `APP_NAME_REGEX`).

### Server settings & SSL  (`RestServiceV2`)
- `GET /server-settings` · `POST /server-settings`
  - Full `ServerSettings` POJO. The POST **persists only `serverName`, `licenceKey`, `nodeGroup`, `logLevel`** (everything else is ignored) **and blanks `serverName`/`licenceKey` when absent.** So always re-POST the whole fetched object with edits merged; a partial POST corrupts those fields. Returns `Result`.
- `POST /ssl-settings?domain={fqdn}&type={type}`: **multipart, write-only. There is NO GET.** `type` is `valueOf()`'d → exact enum name: `CUSTOM_DOMAIN` / `ANTMEDIA_SUBDOMAIN` / `CUSTOM_CERTIFICATE`. For `CUSTOM_CERTIFICATE` upload `fullChainFile`, `privateKeyFile`, `chainFile`. **Restarts the server.** Returns `Result`.

### Licensing  (`RestServiceV2`)
- `GET /enterprise-edition` → `Result{success}`
- `GET /licence-status`: **may be empty** (see gotchas) · `GET /last-licence-status` → `Licence`
- `Licence`: `{ licenceId, startDate, endDate, type, licenceCount, owner, status, hourUsed }`

### Logs  (`RestServiceV2` → `CommonRestService.getLogFile`)
- `GET /log-file/{offset}/{charSize}?logType={null|error}` → `{ logContent, logContentSize, logFileSize }`
  - **Byte offset, not line.** `offset=-1` tails the last `charSize` bytes; `charSize` capped at **512000** (500KB). Tail windows start mid-line; trim the partial first line when `logFileSize > logContentSize`.
  - `logType=error` → second real file (`antmedia-error.log`); else `ant-media-server.log`. **Param required or the call 500s.**
  - Missing file ⇒ `{ logContent: "There is no log yet" }` (no sizes). Logback line format `%d{ISO8601} [%thread] %-5level %logger{35} - %msg%n`.
  - System-scoped; no server-side search/filter/push.

### Cluster  (`ClusterRestServiceV2`, `@Path /v2/cluster`)
**Enterprise + cluster-mode only.** Handlers live in community but `getClusterStore()` is null unless enterprise cluster beans + Mongo/Redis cluster mode are active. **A standalone server 500s on the node endpoints**; gate on `cluster-mode-status`.
- `GET /cluster-mode-status` → `Result{success}` (`success` = in cluster mode). Safe on standalone (`success:false`).
- `GET /cluster/node-count` → `{ number }` · `GET /cluster/nodes/{offset}/{size}` → `ClusterNode[]`; **both 500 on standalone.**
- `DELETE /cluster/node/{id}` → `Result`. A live node re-registers within 5s; only meaningful for stale rows. *Catalog, not wired.*
- `PUT /cluster/node/{id}/note?note=…` (note as a query param) → `Result`. Persists an admin note on the node; empty string clears it, **max 500 chars** (trimmed). Field-scoped write, so it **survives the 5s heartbeat and node restart**; node id from the path, nothing else about the node is mutable here; unknown id → `Result{success:false}` (no phantom row). *Verification + unit tests are open; see [TODO.md](dev-progress/TODO.md). Design: [features/backend-analytics.md](features/backend-analytics.md).*
- `ClusterNode`: `{ id, ip, lastUpdateTime, memory:"usedMB/totalMB", cpu:0-100 (string|number), dbQueryAveargeTimeMs (note spelling), note (admin-set; may be null/absent), status:"alive"|"dead" }`. `cpu` parse defensively; `status` is binary (dead = no heartbeat >20s; period 5s). Client derives a finer warn tier.

### Support  (`SupportRestService`, auth-exempt)
- `POST /support/request` (body `SupportRequest`) → `Result`

---

## Per-app API: `/{app}/rest/v2`

### Broadcasts: CRUD  (`BroadcastRestService`, `@Path /v2/broadcasts`)
- `GET /broadcasts/list/{offset}/{size}?sort_by&order_by&search&type_by` → `Broadcast[]`
- `GET /broadcasts/{id}` → `Broadcast` (full shape: appendix below)
- `POST /broadcasts/create?autoStart={bool}` → `Broadcast` (returns the created object, `status:"created"`). All four stream types ride this one call: `liveStream` (WebRTC), `streamSource` (pull an RTMP/RTSP/SRT/HLS URL), `ipCamera` (host + user/pass; the backend derives the authed RTSP URL via ONVIF), `playlist` (`playListItemList` of `{streamUrl, type:"VoD", seekTimeInMs, name?}` items + `playlistLoopEnabled`; `streamUrl` must be a full openable URL, the server probes `durationInMs` itself). `autoStart` (start pulling immediately) applies to `ipCamera`/`streamSource` only.
- `POST /broadcasts/create-list?onDuplicate={skip|overwrite}` → `Result[]`. **Bulk create (import).** Body is a `Broadcast[]`. `onDuplicate` **omitted → 400** `Result{success:false}` listing the conflicting ids, **nothing created**; `skip` keeps existing streams; `overwrite` deletes+recreates them (a live stream is force-stopped first). Returns one `Result` per stream: `dataId` = stream id, `message` = `created`|`skipped`|`overridden`|`failed`. Reuses the single-create path per item (validation, playlist scheduling); an empty id auto-generates. Community `BroadcastRestService`, served in both editions.
- `PUT /broadcasts/{id}` → `Result`. **A PATCH in PUT's clothing.** The body is a `BroadcastUpdate`, a clone of `Broadcast` whose fields all default to **null**, and `DataStore.updateStreamInfo` applies only the non-null ones. Send a partial body; do **not** re-POST the whole object (the opposite of AppSettings). Applied fields the panel cares about: `name`, `description`, `webRTCViewerLimit`/`hlsViewerLimit`/`dashViewerLimit` (`-1` = unlimited), `streamUrl`, `ipAddr`, `username`, `password`, `playListItemList`, `playlistLoopEnabled`, `plannedStartDate` (unix **seconds**, `0` = unscheduled), `autoStartStopEnabled`. **Ignored even if sent:** `type`, `streamId`, `date`, `mp4Enabled`, `webMEnabled` (recording overrides go through `PUT /broadcasts/{id}/recording/{bool}`), `rtmpViewerCount`, `publishType`. Three behaviours that are not obvious and each have a RISKS.md entry:
  - **`liveStream` merges in place. Every other type routes through `RestServiceBase.updateStreamSource()`**, which validates `streamUrl` against a scheme whitelist (`http`, `https`, `rtmp`, `rtmps`, `rtsp`, `rtsps`, `udp`, `srt`; skipped for playlists and when blank), and, **if the stream is live and is not a playlist, stops it (blocking, up to 5s), applies the patch, and starts it again** whatever the field changed. "Live" here is `broadcasting` **or** `preparing` (`AntMediaApplicationAdapter.isStreaming`). `status` is force-nulled on this path and can never be written. The whitelist check is prefix-only, but it then splits the URL on `//` and indexes `[1]`, so a **bare `rtsp://`** with nothing after it throws and 500s: send a scheme *and* a host.
  - **`ipCamera` derives `streamUrl` itself** by reconnecting over ONVIF from `ipAddr`/`username`/`password`; anything sent there is discarded. Blank credentials are back-filled from the stored row **only if at least one of the three is non-blank** (`!isAllBlank`), and the back-fill mutates the object that then gets persisted, so a blank beside a real value is harmless. Send **all three blank** and the whole block is skipped: no ONVIF reconnect, and `""` is written over the stored host and login. Bad credentials abort the update after the stop, leaving the camera down.
  - **`playListItemList` is a full replace**, and each `type:"VoD"` item's `durationInMs` is re-probed with FFmpeg (long playlists = slow saves). A changed `plannedStartDate` cancels and re-arms the vert.x timer; `0` or a past date arms nothing.
  - On Mongo the result is `getModifiedCount() == 1`, so **a PUT that changes nothing returns `success:false`**. Never send an empty or no-op patch.
- `DELETE /broadcasts/{id}` → `Result`
- `DELETE /broadcasts/?ids=a,b,c` → `Result` (**bulk; not `/bulk`**)
- `GET /broadcasts/count` · `GET /broadcasts/count/{search}` · `GET /broadcasts/active-live-stream-count` → `{ number }`
- `POST /broadcasts/{id}/start` · `POST /broadcasts/{id}/stop` → `Result`
- `PUT /broadcasts/{id}/recording/{bool}` → `Result` (MP4 record override; default recordType mp4)
- `GET /broadcasts/duration` · `PUT /broadcasts/{id}/seek-time/{ms}`: *catalog, not in layer.*

### Broadcasts: monitoring  (`BroadcastRestService`)
- `GET /broadcasts/{id}/broadcast-statistics` → `{ totalRTMPWatchersCount, totalHLSWatchersCount, totalWebRTCWatchersCount, totalDASHWatchersCount }` (`-1` = N/A)
- `GET /broadcasts/total-broadcast-statistics` → same shape, server-wide
- `GET /broadcasts/{id}/webrtc-client-stats/{offset}/{size}` → `WebRTCClientStat[]` (one row per player)
- `GET /broadcasts/{id}/metrics-history` → `{ bitrate, viewers, speed, encoderQueueSize, droppedPackets, droppedFrames, packetLostRatio }`: all `number[]`, oldest→newest; **real** (`StatsCollector` per-stream in-memory ring, push-fed from the ~10s quality-update; capped at `server.stream_metrics_history_size`=720 ≈ 2h). `bitrate` is instantaneous bits/sec (byte-delta over the real interval); `viewers` = WebRTC+HLS+DASH (needs `writeStatsToDatastore`=default-on, else 0). Empty arrays when the stream isn't live / collecting / unsupported. Lost on restart; the durable store is parked in [TODO.md](dev-progress/TODO.md).
- `GET /broadcasts/{id}/stream-info` → track/codec info
- `GET /broadcasts/{id}/connection-events/{offset}/{size}` → per-stream connect/disconnect log. **Building block for Phase 15's event log.**
- `GET /broadcasts/webrtc-send-low-level-stats` · `/webrtc-receive-low-level-stats`: *catalog, not in layer.*

### Tokens  (`BroadcastRestService`)
- `GET /broadcasts/{id}/token?expireDate&type&roomId` · `GET /broadcasts/{id}/jwt-token?expireDate&type&roomId` (`expireDate` = unix seconds; `type` = `play`|`publish`)
- `POST /broadcasts/validate-token` (body `Token`) · `DELETE /broadcasts/{id}/tokens` (revoke all) · `GET /broadcasts/{id}/tokens/list/{offset}/{size}`
- *In layer (`broadcasts(app)`), unwired; no UI yet.*

### Subscribers: TOTP / time-based access  (`BroadcastRestService`)
- `GET /broadcasts/{id}/subscribers/list/{offset}/{size}` · `POST /broadcasts/{id}/subscribers` (body `Subscriber`)
- `GET /broadcasts/{id}/subscribers/{sid}/totp` · `DELETE /broadcasts/{id}/subscribers/{sid}` · `DELETE /broadcasts/{id}/subscribers` (all)
- `PUT /broadcasts/{id}/subscribers/{sid}/block/{seconds}/{type}` (`type` = publish|play|publish_play)
- *In layer (`subscribers(app)`), unwired.*

### IP camera: ONVIF + PTZ  (`BroadcastRestService`)
- `GET /broadcasts/onvif-devices` · `GET /broadcasts/{id}/ip-camera/device-profiles`
- `POST /broadcasts/{id}/ip-camera/move?valueX&valueY&valueZ&movement` (`movement` = absolute|relative|continuous; values −1.0…1.0) · `POST /broadcasts/{id}/ip-camera/stop-move`
- `GET /broadcasts/{id}/ip-camera-error`
- *In layer (`ipcamera(app)`), unwired.* **Note:** the old `ip-camera/move-{left|right|up|down}` form is gone, superseded by `move?valueX…`.

### Restream: RTMP/SRT forwarding  (`BroadcastRestService`)
- `POST /broadcasts/{id}/endpoint` (body `Endpoint` = `{ endpointUrl, type:"generic" }`) → `Result.dataId` = `endpointServiceId` · `DELETE /broadcasts/{id}/endpoint?endpointServiceId`
- The `Endpoint` body field is **`endpointUrl`** (not `rtmpUrl`; the legacy console's older `/rtmp-endpoint` path is gone). `endPointList: Endpoint[]` rides the `GET /broadcasts/{id}` record.
- The optional `resolutionHeight` query param (forward a specific ABR rendition) is **intentionally not surfaced**: endpoints forward the source resolution.
- *Wired (`restream(app)`): stream drawer "Re-streaming" + row ⋯ → Other → Restream Endpoints modal.*

### VoD  (`VoDRestService`, `@Path /v2/vods`)
- `GET /vods/list/{offset}/{size}?sort_by&order_by&search&streamId` → `VoD[]` (`streamId` = exact-match filter; `search` = case-insensitive substring over vodId/vodName/streamId/streamName/description) · `GET /vods/{id}` → `VoD`
- `GET /vods/count` · `GET /vods/count/{search}` → `{ number }`
- `POST /vods/create?name={file}`: **multipart** (`file` part; optional `metadata`)
- `DELETE /vods/{id}` · `DELETE /vods/?ids=a,b,c` (**bulk; not `/bulk`**)
- `POST /vods/directory?directory=` (register a server-side folder) · `DELETE /vods/directory?directory=` (unlink)

### Push notifications  (`PushNotificationRestService`, `@Path /v2/push-notification`)
- `GET /push-notification/subscriber-auth-token?subscriberId&timeoutSeconds`
- `POST /push-notification/subscribers?serviceName` (body `PushNotificationToSubscribers`)
- `POST /push-notification/topics/{topic}?serviceName` (body JSON message)
- *In layer (`push(app)`), unwired.*

### Per-app root  (`RootRestService`, `@Path /v2`)
- `GET /{app}/rest/v2/version`: per-app edition probe. *Catalog, not in layer.*

### Advanced / ENT  (`BroadcastRestService`: catalog, **not in the panel layer**)
Documented for completeness; mostly enterprise-gated. Add to `endpoints/` only when a feature needs them.
- Subtracks/conference: `POST|DELETE /broadcasts/{id}/subtrack`, `GET /broadcasts/{id}/subtracks/{o}/{s}`, `GET /broadcasts/{id}/active-subtracks/{o}/{s}`, `GET /broadcasts/{id}/active-subtracks-count`
- Playlist: `POST /broadcasts/playlists/{id}/next`
- Data channel (hard ENT gate): `POST /broadcasts/{id}/data`
- Metadata injection: `POST /broadcasts/{streamId}/id3`, `POST /broadcasts/{streamId}/sei`
- `POST /broadcasts/{hls_filename}/hls-to-mp4`

---

## Removed / not core: do NOT wire
- **Social media** (`social-endpoints`, `social-networks/*`, comments/interactions): **404 on 4.0.0**, legacy.
- **Detections** (`/broadcasts/{id}/detections/*`): TensorFlow **plugin**, not core; **404** on stock.
- **Old IP-camera PTZ form** (`ip-camera/move-{left|right|up|down}`): superseded by `ip-camera/move?valueX…`.
- **Internal, not panel-facing (ignore):** `/{app}/rest/cluster-communication/*` (node IPC) · `/{app}/whip/*` (WHIP ingest) · `/{app}/analytic/*` (player telemetry) · legacy `/rest/cluster/*` V1.

---

## Does NOT exist yet
The panel mocks these today; each is a backend task. The mock is the swap point: implement the endpoint, delete the mock, no UI change. The deferred features that build on these live in [TODO.md](dev-progress/TODO.md) V2.

| Gap | Mock today | Real backend must provide |
|---|---|---|
| `GET /network-status` | `mocks/dashboard.ts` | `{ outboundMbps, inboundMbps, uplinkMbps }`: NIC tx/rx sampling; `uplinkMbps` is operator-set. (Also owns the `netOut`/`netIn` history series.) |
| Settings descriptor (categories/labels/advanced) | `settings-schema.ts` const | settings-descriptor on the settings response (`getSettingsSchema()` swap seam) |
| `GET /ssl-settings` (cert read-back) | - (write-only) | cert introspection (subject/issuer/expiry/SAN); no ACME API today |
| User MFA / last-login / manual unblock | - | `User` model + endpoints (`…/blocked` is read-only) |
| App-JWT mint for admin | client-side mint from `jwtSecretKey` | Java endpoint that mints an app token for the authed admin (secret stays server-side) |
| Cluster per-node streams/viewers/GPU | optional `RawClusterNode` fields in `mocks/cluster.ts` | grow the `ClusterNode` heartbeat to report them |
| Per-node log proxy | "Show logs" TODO stub | proxy to fetch node X's `/log-file` through the panel origin (fills the `LogSource` seam) |
| Server-wide persistent event log | - | query API over connect/disconnect events (Phase 15; `connection-events` is the per-stream building block) |
| Cluster origin/edge topology | - | which node is origin per stream + edge viewer counts (Phase 19, next priority) |
| SSE / WebSocket push | HTTP polling | live-update transport |

---

## Appendix: captured wire shapes (live capture, frozen 2026-06-15)

Curl'd against `localhost:5080` (Enterprise 4.0.0-SNAPSHOT, standalone), admin session. These
are the **raw wire shapes** the `endpoints/` transforms consume and the mocks must reproduce.
Empty-collection endpoints (`gpu-status`, `broadcasts/list`, `vods/list`) verified as
`[]` / `{number:0}`; object shapes were captured from live data (a throwaway broadcast was
created + deleted to freeze `Broadcast`). The capture's corrective findings (empty
`licence-status`, cluster 500 on standalone, `logType` required) are folded into the gotchas
list at the top of this file.

### Management `/rest/v2` shapes

```ts
// version  (also served per-app at /{app}/rest/v2/version)
{ versionName: "4.0.0-SNAPSHOT", versionType: "Enterprise Edition", buildNumber: "20260610_1236" }
// {success} envelope: enterprise-edition, authentication-status, first-login-status, cluster-mode-status
{ success: boolean, message: string, dataId: string, errorId: number }
// system-resources  (the dashboard firehose)
{
  instanceId: string,
  cpuUsage: { processCPUTime: number, systemCPULoad: number, processCPULoad: number, systemLoadAverageLastMinute: number },
  jvmMemoryUsage:    { maxMemory: number, totalMemory: number, freeMemory: number, inUseMemory: number },
  systemInfo:        { osName: string, osArch: string, javaVersion: string, processorCount: number },
  systemMemoryInfo:  { virtualMemory, totalMemory, freeMemory, inUseMemory, totalSwapSpace, freeSwapSpace, inUseSwapSpace, availableMemory: number },
  fileSystemInfo:    { usableSpace, totalSpace, freeSpace, inUseSpace: number },
  jvmNativeMemoryUsage: { inUseMemory: number, maxMemory: number },
  softwareVersion:   { versionName, versionType, buildNumber: string },
  gpuUsageInfo: GpuInfo[],          // [] when no GPU
  ffmpegBuildInfo: string,
  dbAverageQueryTimeMs: number,
  localWebRTCLiveStreams, localLiveStreams, localWebRTCViewers, localHLSViewers, localDASHViewers: number,
  "encoders-blocked", "encoders-not-opened", "publish-timeout-errors": number,
  "vertx-worker-thread-queue-size", "webrtc-vertx-worker-thread-queue-size": number,
  "server-timing": { "up-time": number, "start-time": number },
  totalLiveStreamSize: number,
  license: Licence
}
// per-metric subsets (standalone endpoints, same fields as the umbrella):
// cpu-status = cpuUsage ; system-memory-status = systemMemoryInfo ; jvm-memory-status = jvmMemoryUsage
// file-system-status = fileSystemInfo ; system-status = systemInfo ; live-clients-size = { totalConnectionSize, totalLiveStreamSize }
// gpu-status = GpuInfo[] (was [] here) ; server-time = { "up-time": number, "start-time": number }
// Licence  (last-licence-status & system-resources.license; licence-status can be EMPTY, see gotchas)
{ licenceId: string, startDate: string, endDate: string, type: string, licenceCount: string, owner: string, status: string, hourUsed: string }
// applications  /  applications-info
{ applications: string[] }
[{ name: string, liveStreamCount: number, vodCount: number, storage: number }]
// user-list  (array of)
{ email: string, userType: "ADMIN"|"USER"|"READ_ONLY", scope: string, appNameUserType: Record<string,string>, firstName: string|null, lastName: string|null, fullName: string|null, picture: string|null }
// server-settings  (whole-POJO re-POST invariant holds, see RISKS.md)
{ allowedDashboardCIDR, hostAddress, serverName, licenceKey, marketplace, logLevel, nativeLogLevel, webRTCLogLevel, nodeGroup, proxyAddress: string|null,
  buildForMarket, offlineLicense, heartbeatEnabled, useGlobalIp, jwtServerControlEnabled, sslEnabled: boolean,
  jwtServerSecretKey, jwksURL: string, cpuMeasurementPeriodMs, cpuMeasurementWindowSize, defaultHttpPort, originServerPort, srtPort, rtmpPort: number,
  appIngestsSrtStreamsWithoutStreamId: string, serverStatusWebHookURL: string|null, localLicenceServerIps: string|null, hostAddressFromEnvironment: string|null }
// log-file  (needs ?logType=null|error, see gotchas)
{ logContent: string }
```

### Per-app `/{app}/rest/v2` shapes

```ts
// broadcasts/count, broadcasts/active-live-stream-count, vods/count
{ number: number }
// broadcasts/{id}/broadcast-statistics   (-1 = not applicable, e.g. RTMP watchers)
{ totalRTMPWatchersCount: number, totalHLSWatchersCount: number, totalWebRTCWatchersCount: number, totalDASHWatchersCount: number }
// broadcasts/{id}/webrtc-client-stats/{o}/{s} -> WebRTCClientStat[]   (was [] on capture; shape per Java/mock)
// broadcasts/create & broadcasts/{id} & broadcasts/list[] -> Broadcast (frozen below)
{
  streamId: string, status: "created"|"broadcasting"|"finished"|"preparing"|..., type: "liveStream"|"ipCamera"|"streamSource"|"VoD"|"playlist",
  playListStatus: string|null, publishType: string|null, name: string, description: string|null, publish: boolean,
  date: number, plannedStartDate: number, plannedEndDate: number, duration: number,
  endPointList: Endpoint[]|null, playListItemList: PlayListItem[]|null, publicStream: boolean, is360: boolean,
  listenerHookURL: string|null, category: string|null, ipAddr: string|null, username: string|null, password: string|null, quality: string|null,
  speed: number, streamUrl: string|null, originAdress: string, mp4Enabled: number, webMEnabled: number, seekTimeInMs: number,
  subtracksLimit: number, expireDurationMS: number, rtmpURL: string, zombi: boolean, pendingPacketSize: number,
  hlsViewerCount: number, dashViewerCount: number, webRTCViewerCount: number, rtmpViewerCount: number,
  startTime: number, receivedBytes: number, bitrate: number, width: number, height: number, encoderQueueSize: number,
  dropPacketCountInIngestion: number, dropFrameCountInEncoding: number, packetLostRatio: number, packetsLost: number, jitterMs: number, rttMs: number,
  userAgent: string, remoteIp: string|null, latitude: string|null, longitude: string|null, altitude: string|null,
  mainTrackStreamId: string|null, absoluteStartTimeMs: number, webRTCViewerLimit: number, hlsViewerLimit: number, dashViewerLimit: number,
  subFolder: string|null, currentPlayIndex: number, metaData: string|null, playlistLoopEnabled: boolean, updateTime: number, role: string|null,
  hlsParameters: object|null, autoStartStopEnabled: boolean, encoderSettingsList: EncoderSettings[]|null, virtual: boolean, maxIdleTime: number, anyoneWatching: boolean
}
// create returns the Broadcast directly (status:"created"); delete -> {success} envelope.

// vods/list[] -> VoD[]  (captured live, enterprise 4.0.0, 2026-07-11)
{
  streamName: string|null, vodName: string, streamId: string,  // streamId = "file" for uploadedVod
  creationDate: number, startTime: number,                     // ms epoch; startTime 0 for uploads
  duration: number, fileSize: number,                          // ms · bytes
  filePath: string,                                            // web-relative: "streams/<name>.mp4"
  vodId: string, type: "streamVod"|"uploadedVod"|"userVod",
  previewFilePath: string|null,  // ABSOLUTE server path (…/webapps/{app}/previews/x.png), unlike filePath; resolve via vodPreviewUrl
  processStatus: string|null,    // null on recordings; "inqueue"|"processing"|"finished"|"failed" when the pipeline ran
  processStartTime: number, processEndTime: number,
  description: string|null, metadata: string|null, latitude: string|null, longitude: string|null, altitude: string|null
}
// All fields always present (nulls emitted). Files serve at /{app}/{filePath}; rows can outlive
// deleted files (an old recording 404s while its row persists), so players must tolerate 404.
// app-settings: applications/settings/{app} -> flat AppSettings POJO (~160 keys, no grouping); jwtSecretKey lives here (the app-JWT mint reads it).
```
