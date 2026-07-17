# Risks & Known Hazards

Architectural risks, security caveats, and edge cases identified during reviews. Refresh this list during code reviews; silent risk is the worst kind.

## Security

### JWT token in `localStorage` (per-app auth)
**Where:** `src/lib/api/client.ts`: `appApi(name)` reads `localStorage[`${name}jwtToken`]` and sends as `Authorization` header.
**Risk:** Any XSS in the panel can exfiltrate the token. Token grants full per-app API access.
**Why we accept:** Mirrors the legacy AMS admin panel contract; users already trust this pattern. Cookies aren't an option (different origin path semantics under `/{appName}/`).
**Mitigations in place:** Token only sent on per-app calls (not management `/rest/v2/`); JWT is per-app-scoped (not global admin).
**Future:** Consider a short-TTL JWT issued from a server endpoint instead of letting users paste long-lived tokens.

### App JWT minted client-side from the app secret
**Where:** `src/lib/api/app-jwt.ts`. On a 403, `appApi` reads the app's `jwtSecretKey` via management settings and signs a short-lived HS256 token (Web Crypto) in the browser.
**Risk:** the raw `jwtSecretKey` is fetched into the browser; XSS could read it and mint arbitrary app tokens. The minted token is in-memory only (5-min TTL), but the *secret* is the real exposure.
**Why we accept:** the requirement is "the panel must reach a JWT-protected app with or without a pasted token," and only an admin (who can already read every app's secret) can trigger this. No backend change was available.
**Mitigations in place:** lazy: the secret is read only when an app actually 403s (open apps never fetch it); token is short-TTL and never persisted; app 403 is isolated from the global session (`suppressAuthEmit`).
**Over plain HTTP the panel cannot mint at all:** `crypto.subtle` exists only in a secure context (localhost excepted), so `mint()` returns `null` and the 403 stands. A JWT-protected app then needs a pasted `{app}jwtToken`, or TLS. Not a regression (minting never worked there), but it *looks* like the IP-filter symptom above, so check the origin before debugging the proxy.
**Future:** a backend endpoint that mints an app token for the authenticated admin, so the secret never leaves the server. Then delete `app-jwt.ts`'s mint path. Tracked in [TODO.md](dev-progress/TODO.md) V2.

### App with JWT control enabled but NO secret key → every per-app call 403s (and the client-side mint can't rescue it)
**Symptom:** `GET /{app}/rest/v2/...` returns 403 ("Invalid App JWT Token") for *all* calls; the streams list shows "Could not load streams: Forbidden". Not the session cookie, not the IP filter: the app's REST `JWTFilter`.
**Cause:** the app has `jwtControlEnabled: true` but an empty `jwtSecretKey` (and no `jwksURL`). The filter calls `Algorithm.HMAC256(jwtSecretKey)`; with no usable key, no token can validate, so it rejects everything. `LiveApp` hit exactly this. (The stream-level `publishJwtControlEnabled`/`playJwtControlEnabled` have the same trap with `jwtStreamSecretKey`, which the enterprise `TokenService` requires to be **≥32 chars**.)
**Why the client-side mint doesn't save it:** `app-jwt.ts`'s `mint()` bails when the secret is blank (`if (!secret) return null`): minting against an empty key would be a degenerate/insecure token, so it correctly refuses and the 403 surfaces honestly.
**Fix (frontend-only; backend deliberately NOT touched, to keep 100% app compatibility):** the App › Settings editor refuses to save a security control that would lock access out. `fieldStatus()` in `settings-schema.ts` flags every secret/key field; `settings-tab.tsx` blocks Save (+ a red banner listing each offender, click-to-jump) while any **error** stands. Covers the whole family, each evaluated only while its control toggle is on:
- **error (blocks Save):** a `required` secret left blank → "blocks all access"; or `jwtStreamSecretKey` shorter than its `strictLen: 32` (enterprise `TokenService` rejects shorter → lockout).
- **warning (informational):** non-empty but below the soft `minLen` (e.g. REST `jwtSecretKey` < 32 still *works*, so it's not blocked; preserves compatibility).
- Fields wired: `jwtSecretKey` (REST), `jwtStreamSecretKey` (stream), `timeTokenSecretForPublish/Play` (TOTP), `remoteAllowedCIDR` (IP filter; empty while `ipFilterEnabled` = no allowed ranges). Each has a **Generate** button.
**Why frontend-only is enough here:** the panel is the admin tool, so blocking the bad save at the source of edits prevents the footgun without diverging the shared backend. A misconfigured app loaded from elsewhere still surfaces the banner (computed from the draft on load), even before any edit.
**Not surfaced (so not validated):** hash-token control (`hashControlPublish/PlayEnabled` + `tokenHashSecret`) isn't in the settings schema yet; add the fields with `required: true` on `tokenHashSecret` if/when it's exposed. The random one-time token controls (`publish/playTokenControlEnabled`) need no secret, so they're correctly left unchecked.

### User passwords are MD5-hashed client-side
**Where:** `src/features/server-settings/use-users.ts` (create/edit/change-password) + `src/lib/auth/md5.ts` (login).
**Risk:** MD5 is cryptographically broken; the panel hashes passwords client-side and the server stores the MD5. Over plain HTTP the hash is also sniffable and replayable.
**Why we accept:** It's the existing AMS authentication contract: login, user CRUD, and password change all speak MD5. "Fixing" only the panel side would break auth. Same-origin + TLS (the SSL tab's whole point) is the real mitigation.
**Watch:** If the backend ever moves to a real KDF (bcrypt/argon2), drop `md5.ts` in the same change. Don't add a second hash on top; the server expects raw MD5.

### CSRF relies on same-origin
**Where:** All state-changing requests (POST/PUT/DELETE).
**Risk:** No CSRF token. Protection depends on (a) session cookie being `SameSite=Lax` or stricter, and (b) panel + API sharing an origin.
**Why we accept:** AMS backend doesn't issue CSRF tokens; same-origin enforcement is the existing model.
**Watch:** If the panel is ever served from a different origin than the AMS REST endpoints, this protection vanishes.

### `localStorage` available everywhere
**Where:** Theme settings, mock session, per-app JWT, drawer collapse state.
**Risk:** Storage quotas vary; **`localStorage.getItem` throws in Safari Private Browsing and on group-policy-hardened browsers, and `setItem` throws again when the quota is full.**
**Mitigations in place:** All access goes through **`src/lib/localStorage.ts`**: the `storage` object swallows every throw (read → fallback, write → no-op) and `useStoredState` is the persisted-state hook built on it. The only direct `window.localStorage` left is the pre-bundle theme bootstrap in `index.html` (runs before the module loads; carries its own try/catch).
**Audit:** New persistence MUST go through `storage` / `useStoredState`. Never call `window.localStorage` directly (`grep` for it in review); a raw call is a bug, not a style nit.

## API / data model

### A failed `Result` is not guaranteed to say why
**Where:** `src/lib/api/types.ts`: `resultMessage` / `resultError` / `errorMessage`.
**Symptom:** an empty red banner. Nothing but the icon and the close button.
**Cause:** several backend failures answer `{"success":false,"message":"","dataId":"","errorId":0}`. Starting a playlist or a stream source whose file will not open is the reliable one: the REST layer returns the empty `Result` and the real reason only ever reaches the server log. Read a failure with `res.message ?? fallback` and the empty string wins, because `??` only guards null/undefined.
**Same hole on the throw path:** `statusText` is always empty over HTTP/2, so an `ApiError` built from an empty body has no server text to show; `transport.ts` falls back to `Request failed (HTTP <status>)`.
**Rule:** never read `res.message` (or a caught `err.message`) directly for display. Go through `resultError(res, fallback)` / `errorMessage(e, fallback)`, and write a fallback that says what failed and where to look, because when it fires the server has told the user nothing. `resultMessage(res)` returns `undefined` (not `''`) for the call sites that prefix the server's own words.
**Backstop:** `useToast.flash` substitutes a generic message for a blank one, so a missed call site degrades to a vague banner rather than an empty one. It is a net, not a licence to skip the fallback.

### Per-app REST is unreachable from a browser: it MUST go through the backend proxy
**Where:** `src/lib/api/transport.ts` (rewrite gated on `pushToBackendProxy`), set by `appApi` in `client.ts`.
**Symptom:** every `/{app}/rest/v2/...` call returns `403 "Not allowed IP"`; streams/VoD tabs show "Could not load …". Looks like an auth bug; it is not.
**Cause:** `ipFilterEnabled` defaults **true**, `remoteAllowedCIDR` defaults **`127.0.0.1`** (`AppSettings.java`), and `IPFilter` is mapped on each app's `/rest/*`. Only the server itself may call app REST.
**Not reproducible in dev-live.** Vite proxies to the backend, so with AMS on the same box the request reaches Tomcat from `127.0.0.1` and passes. It fails only once the panel is served from `webapps/root`. Test this deployed, not in dev.
**Mitigation:** `FetchTransport` rewrites app URLs onto root's `ProxyServlet` (`/rest/v2/request?_path=…`), which re-issues the call from the server. Design + encoding rules: [ARCHITECTURE.md](ARCHITECTURE.md) *Backend proxy*.
**Watch:** never drop the rewrite to "simplify"; never widen `remoteAllowedCIDR` to make a direct call work (that exposes every app's REST API to the network); never proxy **management** calls (`AuthenticationFilter` exempts the login/bootstrap endpoints by exact outer URI, so a proxied `/users/authenticate` 403s and the panel can never log in).
**Inherited limit:** the servlet's `targetUri` hardcodes `http://localhost:5080`, so a non-default HTTP port breaks app calls. Same in the legacy console, which uses this servlet too.

### Dashboard mixes real and placeholder widgets
**Where:** `src/features/dashboard/*` + `dashboard-widgets.md`.
**Risk:** The dashboard mixes real and placeholder data sources, so a presented number may be fabricated. The only placeholders are the app-row **health** slot (no backend metric; renders a TODO card) and the cluster page's per-node streams/viewers/GPU (mock-projected optional fields). Everything else is real: history charts, app-drilldown viewers/streams, GPU, cluster CPU/Mem, network bandwidth (host-only, reads zero in containers; see [dashboard-widgets.md](features/dashboard-widgets.md) §1). Easy to mistake one for the other, or to "fix" an empty widget against a real server when the endpoint simply doesn't exist yet.
**Why we accept:** The whole point is a complete-looking panel ahead of the future backend endpoints (TODO.md V2); placeholders sit behind real-shaped endpoints so the swap is zero-frontend-change.
**Watch:** Before claiming a dashboard metric is live, check the real/placeholder table in `dashboard-widgets.md`. When a backend ships, delete the mock and the widget lights up with no UI change.
**Robustness already in place:** `useDashboardData` merges `/system-resources/history` over `EMPTY_HISTORY` **per key**, and `app-row` normalises its history, so a real endpoint that returns a *subset* of the series (e.g. no `netOut`/`netIn`) degrades to an empty chart instead of crashing on `undefined.length`. Keep that contract if you touch the history hooks.
**Minor cost:** the dashboard mounts `useCluster()` to gate the cluster card, so it polls `cluster-mode-status` + `cluster/nodes` every 5s even on a standalone server (card hidden). Cheap; revisit only if standalone dashboards show poll pressure.

### `useApi.refetchKey` proliferation
**Where:** `src/lib/api/use-api.ts`: opt-in string key triggers refetch on closure-dep change.
**Risk:** Each consumer concatenates its own key (`${a}|${b}|${c}`). Easy to forget a dep → stale data again. No type checking.
**Why we accept:** A typed-deps API (`deps: unknown[]`) would either break ESLint rules-of-hooks or require a hash, both noisy.
**Watch:** If 3+ consumers add complex keys, build a `useApiQuery(fetcher, deps[])` helper that hashes for them.

### `useApi` returns a fresh object every render
**Where:** `src/lib/api/use-api.ts`.
**Risk:** Consumers who destructure `{ refresh }` get a stable reference (good). Consumers who pass the whole hook return to a `useCallback`/`useMemo` get false invalidation every render.
**Mitigation:** `useBroadcasts.refresh` extracts `.refresh` from each inner hook before wrapping (see file for pattern).
**Watch:** Document the pattern when wrapping multiple `useApi` instances.

### Backend version compatibility
**Where:** All hooks assume the current AMS endpoint shapes.
**Risk:** Older AMS versions may not expose `/broadcasts/active-live-stream-count`, `/applications-info`, etc. Silent 404 → blank UI.
**Watch:** The Server Settings page should surface backend version + a warning when below the minimum supported.

### Mock registry can leak between concerns
**Where:** `src/lib/api/mock.ts`. Literal registrations override pattern registrations because literals are checked first.
**Risk:** A mock file unrelated to a domain can shadow a domain mock if it registers a more-specific literal path. Hit this in practice: `broadcasts.ts` was overriding `LiveApp` app-settings.
**Mitigation:** Per-domain overrides live in the same file as the domain default (see `applications.ts` `SETTINGS_OVERRIDES`).
**Watch:** When adding mocks, search for existing patterns that match the path first.

### App settings save must POST the WHOLE POJO
**Where:** `src/features/apps/settings-tab.tsx` (draft) → `saveAppSettings` → `POST /applications/settings/{name}`.
**Risk:** `AppSettings` has ~200 fields; the editor's schema surfaces ~40. The save sends the **entire** fetched object with edits merged in. If anyone "optimises" this to POST only the changed/visible fields, the backend overwrites settings with a partial object and **wipes the ~160 unsurfaced fields**.
**Mitigation:** draft is initialised to the whole fetched POJO and never narrowed; the mock seeds non-schema keys (`maxIdleTime`, `webRTCPortRange*`, …) so a round-trip that drops them shows up immediately.
**Watch:** Keep the "draft = full POJO" invariant. Never build the save body from `SCHEMA_KEYS`.

### Settings schema keys must match real `AppSettings` field names
**Where:** `src/features/apps/settings-schema.ts`.
**Risk:** A key that doesn't exist on the Java POJO saves silently into a dead field: no error, no effect. The prototype used invented keys (`recordAsMp4`, `hlsEnabled`, …); the real ones were verified against `AppSettings.java` + the Angular console (`mp4MuxingEnabled`, `hlsMuxingEnabled`, …).
**Watch:** When adding a field, confirm the key against the POJO. Two gotchas already handled: `acceptOnlyStreamsInDataStore` is the **real** field (the console's inverted "Accept Undefined Streams" toggle would be a bug against it); `hlsListSize`/`hlsTime` are **String** on the wire ("15"/"2"), so the number stepper preserves each field's JS type instead of coercing to `number`.

### Settings schema `def`s must mirror `AppSettings.java` initializers
**Where:** `settings-schema.ts` (`def`, `parseFieldValue`; value-semantics rules are documented there) + reset buttons and import in `settings-tab.tsx`.
**Risk:** absent/null values display `def`, and reset buttons write it. If a `def` drifts from the Java initializer, the form shows one value while a save that omits the key lands the other; no error, just a silent mismatch. Same class as the field-name risk above, but for values.
**Watch:** copy `def`s from `AppSettings.java`, not from docs, and interpret values only through `parseFieldValue`; a local re-coercion reintroduces the display-vs-wire divergence that design killed. The V2 settings-descriptor API retires this class.

### App settings save is last-write-wins
**Where:** `settings-tab.tsx` → `saveAppSettings` (POST the whole POJO).
**Risk:** No version/ETag. The editor fetches the POJO once on mount; two admins editing the same app's settings means the later Save silently overwrites the earlier one from a possibly-stale base.
**Why we accept:** Matches the existing AMS console; the backend settings contract has no optimistic-concurrency token.
**Watch:** If concurrent admin editing becomes real, re-fetch + diff before POST (or surface a server version field) instead of blind-writing.

### Renditions wire shape (`encoderSettings` vs `encoderSettingsString`)
**Where:** `settings-schema.ts` `encoderSettings` field + `RenditionEditor`.
**Risk:** We model renditions as a `{height, videoBitrate, audioBitrate, forceEncode?}[]` under key `encoderSettings`. The POJO's stored field is `encoderSettingsString` (a JSON **string**); the REST layer exposes a `List` getter, but this hasn't been confirmed against a live server. If the real `GET` returns `encoderSettingsString` instead of `encoderSettings`, the ladder shows empty and a save won't update renditions.
**Watch:** Verify the wire field name when first pointing at a real backend; the editor preserves unknown row keys (`forceEncode`) via object spread, so only the container key is at risk.
**Second consumer:** the `generatePreview` rule reads `encoderSettings` to warn "needs at least one rendition". It fires only on an `Array.isArray(…) && length === 0`; an **absent** key means we can't tell, so it stays silent rather than warn on every app. If the real GET turns out to send `encoderSettingsString`, that warning silently never fires; fix the container key and it starts working with no other change.

### `generatePreview` does nothing without a rendition, and nothing on Community
**Where:** `settings-schema.ts`, two `FieldRule`s on `generatePreview`.
**Backend truth:** `MuxAdaptor` only stores the flag. The sole reader is `EncoderAdaptor.initPreviewMuxing()` (Ant-Media-Enterprise), reached **only** from the `encoderSettingsList != null && !isEmpty()` branch. With no renditions the stream takes the SFU-forward branch and no `PreviewMuxer` is ever constructed, so previews are silently never written. `MuxAdaptor.isEncoderAdaptorShouldBeTried()` also returns true for `webRTCEnabled || forceDecoding`, which is why the transcoder gets *constructed* and the failure looks like nothing at all.
**Why warning, not blocker:** the effective rendition list can come from the `Broadcast` (`encoderSettingsList`), so an app with none can still produce previews for a stream that overrides them. We cannot prove the config is broken, only that it's probably pointless.
**Watch:** don't promote either rule to `error`. On Community the flag is inert entirely (`EncoderAdaptor` isn't in that build), which is the first rule.

### Server settings: a partial POST CORRUPTS, not just ignores
**Where:** `src/features/server-settings/use-server-settings.ts` → `POST /server-settings`.
**Risk:** `changeServerSettings` persists only `serverName`/`licenceKey`/`nodeGroup`/`logLevel` and **blanks `serverName`/`licenceKey` (writes `"null"` to `nodeGroup`) when they're absent from the body.** So POSTing only the changed field doesn't just no-op the rest: it wipes the server's name and license key. Worse than the AppSettings case (which only drops unsurfaced fields).
**Mitigation:** `ServerTab` holds the **whole fetched POJO** as draft and re-POSTs it with edits merged; the mock reproduces the blanking so a partial POST visibly corrupts in dev.
**Watch:** Never build the server-settings body from just the edited fields. Keep the whole-POJO invariant.

### SSL is write-only and restarts the server
**Where:** `src/features/server-settings/use-ssl.ts` → `POST /ssl-settings` (multipart).
**Risk:** No GET: the panel can't confirm what cert is active, so the TLS tab can't show or verify current state (it only *applies*). Applying **restarts Ant Media Server** (drops streams, panel unreachable ~1 min). `type` is `valueOf()`'d server-side, so a wrong string 500s.
**Mitigation:** A confirm modal spells out the restart; `type` is constrained to the enum names in code; an honest "can't read back the active cert" note is shown.
**Watch:** If a `GET /ssl-settings` ever ships, wire it so the tab shows current state instead of flying blind.

### Playlist item `streamUrl` must be a full, openable URL
**Where:** playlist create/edit (`streams/editor/playlist-items.tsx`, `vodPlaylistUrl` in `features/vods/url-builder.ts`) → `Broadcast.playListItemList`.
**Risk:** the backend passes each item's `streamUrl` verbatim to FFmpeg and reachability-checks it over HTTP (`StreamFetcherManager.checkStreamUrlWithHTTP`); anything that isn't an openable URL is silently skipped at play time. There is no server-side id-reference or resolution of any kind: the string in the item is exactly what gets played.
**Mitigation:** picks resolve to the VoD's playable URL (`/{app}/{filePath}`, origin-relative like the VoDs tab "Copy URL"). On apps with `playJwtControlEnabled`, a bare file URL won't play, so `vodPlaylistUrl` mints an infinite-expiry play JWT and appends `?token=` (legacy console parity; the mint degrades to the bare URL on failure rather than blocking the pick).
**Watch:** the embedded token never expires and is stored in the playlist item; a short-lived token minted at play time (or server-side VoD resolution) would be better. Legacy console footnote: its bulk VoD delete calls `DELETE /vods/bulk/` with a body; that endpoint doesn't exist on the current backend (`DELETE /vods/?ids=` is correct), so don't "fix" toward legacy.

### Saving a live `streamSource` / `ipCamera` stops and restarts it
**Where:** `streams/editor/edit-stream-modal.tsx` → `PUT /broadcasts/{id}` → `RestServiceBase.updateStreamSource()`.
**Risk:** the backend routes every type except `liveStream` through `updateStreamSource`, which, if the
stream is live (`broadcasting` **or** `preparing`) and is not a playlist, calls `checkStopStreaming` +
`waitStopStreaming` (blocking, up to
5s), applies the patch, then `startStreaming` again. It triggers on **any** field, so *renaming a live IP
camera cuts its feed*. Worse, the stop happens **before** the patch is validated: bad camera credentials
(`connectToCamera` fails) or an unreachable URL abort the update and return `success:false` with the
stream left **down**. And `startStreaming`'s own failure ("Not enough resource on server") is ignored, so
`success:true` does not prove the stream came back.
**Mitigation:** the modal renders a callout and relabels Save to "Save and restart" whenever the stream
is live and pulled; a failed save appends "the stream was stopped ... and may not have restarted" to the
server's message. `liveStream` (plain merge) and `playlist` (never stopped) are unaffected.
**Watch:** don't "helpfully" widen the restart warning to publishers (it's wrong: they take the merge
path) or drop it from a rename (it's right: the restart isn't field-scoped). Always re-read the broadcast
after a save; the `Result` is not proof of state.

### `ipCamera` `streamUrl` is server-derived; sending it is discarded
**Where:** `streams/editor/draft.ts` `toWire()` deliberately omits `streamUrl` for `ipCamera`.
**Risk:** `updateStreamSource` reconnects over ONVIF from `ipAddr` + `username` + `password` and
**overwrites** `streamUrl` with the RTSP-with-auth URL it derives. Anything the panel sends there is
thrown away. The legacy console's "Onvif Url" field binds `streamUrl` and is simply a lie: it looks
editable and does nothing. Don't port it.
**Second trap, all-or-nothing back-fill:** the ONVIF block is gated on
`!StringUtils.isAllBlank(ipAddr, username, password)`. Inside it, each blank field is back-filled from the
stored row **onto the object that then gets persisted**, so a blank password beside a real host is
harmless. Send **all three blank** and the gate fails: no reconnect happens, and `updateBroadcastFields`
writes `""` over the stored host and login, bricking the camera. `toWire` omits a blank credential
("blank = keep the stored one") and the modal blocks a blank host, so the panel cannot reach that state.
**Watch:** don't "simplify" `toWire` into sending every camera field unconditionally.

### A no-op `PUT /broadcasts/{id}` answers `success:false` on Mongo
**Where:** `MongoStore.updateBroadcastFields()` → `result = updateResult.getModifiedCount() == 1`.
**Risk:** a PUT that changes nothing is reported as a **failure**, not a no-op. Any code that POSTs a
whole object, or a patch whose values happen to equal what's stored, gets a phantom red banner.
**Mitigation:** `streams/editor/draft.ts` diffs seed-vs-current and the edit modal disables Save until the patch
is non-empty, so a no-op patch can never be sent. Values are compared **after** normalisation (trim,
limit sentinel, playlist projection), so retyping the same value or adding a trailing space is not dirty.
**Watch:** the in-memory and map stores don't have this behaviour, so a mock-only test will never catch a
regression here. Keep the dirty check.

### Playback tokens ride on the player URL
**Where:** `usePlayUrl` (`features/streams/use-play-url.ts`) → the `play.html` iframe in `player-modal.tsx`.
**Risk:** an app can gate playback three ways, and each behaves differently. `playTokenControlEnabled` mints a **one-time** token: the iframe spends it, so the modal's "Open in new tab" (which reuses the resolved URL) plays a spent token and fails. `playJwtControlEnabled` mints a JWT (reusable until it expires, 100s). `enableTimeTokenForPlay` (TOTP) cannot be minted client-side at all.
**Mitigation:** the token is minted per playback and short-lived (legacy console parity: `now + 100s`, so the window to first frame, not a durable grant). TOTP is refused with an explicit message instead of a black player. A failed mint degrades to a bare URL so the player reports the auth error itself.
**Watch:** the `⋯ > Play With WebRTC/HLS` items and row middle-click open **untokenized** tabs (they are synchronous, and a mint is not), so on a gated app those tabs won't play; the embedded player is the tokenized path. Fixing that properly needs a server-side mint (same V2 item as the app-JWT one above).

### Identity does not ride the session
**Where:** `src/contexts/auth-context.tsx` (`ams.auth.user`) + `src/lib/auth/api.ts` (`toAuthUser`).
**Cause:** there is no "who am I" endpoint. `authentication-status` is a bare boolean, and `GET /users` is admin-gated (and would not say which row is us). Identity appears in one place only: the `message` field of the `POST /users/authenticate` response. Only the panel that performs the login ever sees it.
**Symptom:** boot on a session we did not create, no stored user, so `user = null`. Logged in, but rendered as nobody: `isAdmin` false, no scopes, "App user" in the sidebar, "Unknown user" in the account menu, admin actions hidden in the Users tab. Nothing crashes, nothing logs you out, so it is easy to miss.
**Why it matters:** with the legacy switcher, the old login is the only door, so it is *always* the one that authenticates. This is the normal path, not an edge case.
**Mitigation:** the old console writes `ams.legacy.auth.handoff = {email, message}` on every login; the panel consumes it on boot when it has no stored user. Contract + reasoning: [features/legacy-switcher.md](features/legacy-switcher.md).
**Watch:** the handoff shape is a cross-repo contract with the Angular console. Never change it on one side only. A backend `GET /current-user` would retire this entry and the key with it.

## Deployment

### Relative asset base: two things are load-bearing
**Where:** `vite.config.ts` (`base: './'`), deployed to `webapps/root/reborn-panel/` next to the old console at `/`. Why it is relative: [features/legacy-switcher.md](features/legacy-switcher.md).
**Watch:** REST paths must stay **origin-absolute** (`/rest/v2/...`); a relative one would resolve inside the panel folder and 404. And **BrowserRouter is off the table**; a path router needs a real base, which a relative build cannot give it. Wanting one means freezing the folder name and setting `base` to the real deploy path.

### An app named `reborn-panel` makes the panel unreachable
**Where:** the deploy path `webapps/root/reborn-panel/`.
**Cause:** app names match `^[a-zA-Z0-9_-]*$`, so that name is creatable, and a Tomcat context at `/reborn-panel` wins over root serving the same path. The panel 404s until the app is renamed. Not a new class of problem (an app named `images` would shadow root's `images/` folder today), just load-bearing here.
**Mitigation:** the backend reserves the name.
**Watch:** rename the folder and the reservation has to move with it.

## Concurrency

### Mutations have no client-side lock
**Where:** `app-streams-tab.tsx` (bulk delete) and `stream-actions.ts` (`useStreamActions.run`).
**Risk:** Rapid clicks dispatch multiple start/stop/delete calls. Server is the source of truth so no corruption, but UI may flash mismatched states and toasts may fire out of order.
**Mitigation in place:** one `busy` flag, owned by `useStreamActions`, disables the toolbar, the row action buttons and the drawer's action tile while any start/stop is in flight. Force-stopping a publisher is additionally confirm-gated (`confirm-force-stop-modal.tsx`), which owns its own `busy`.
**Watch:** the `⋯` menu items are NOT gated (the menu closes on click, so a rapid double-fire needs two deliberate opens). Bulk delete is gated by the confirm modal instead. Revisit only if reports come in.

### Selection survives page changes
**Where:** `app-streams-tab.tsx`: `selected: Set<string>` persists across pagination.
**Risk:** "5 selected" badge shows even on a page where 0 selected items are visible. Bulk delete acts on the cross-page set, possibly surprising.
**Why we accept:** Common pattern in admin tables; surprises are less bad than losing selection on navigation.
**Watch:** If users report confusion, surface a "Clear selection" pill when there are selected items not visible on the current page.

## Performance

### `useBroadcasts` fires 3 polls every 5s per mount
**Where:** `src/features/streams/use-broadcasts.ts`: list + count + active-count.
**Risk:** 36 req/min per open Streams tab. With N tabs open, N×36/min.
**Why we accept:** Each endpoint serves a distinct UI concern; combining couples failure modes.
**Watch:** If traffic profiles complain, combine into one request that returns all three, or use SSE via a future backend transport (TODO.md V2).

### A cross-app "all streams" table is O(apps) per poll
**Risk:** there is no cross-app streams endpoint, so a global table must fan out per app. At 2 endpoints per app every 8s, 50 apps is ≈12.5 req/sec for one page. This is why streams live under App › Live Streams and there is no global `/streams` page.
**If it returns (TODO.md V2):** it needs durable per-app aggregates or one combined backend query first. Never reintroduce the per-app fan-out.

## UX / accessibility

### Modal autofocus relies on a `data-autofocus` attribute
**Where:** `src/components/ui/modal.tsx`.
**Risk:** New consumers that forget the attribute have no focus restoration; keyboard users tab from `<body>`.
**Mitigation:** Convention documented in Modal source comment.
**Watch:** Lint rule possible; defer unless we add multiple new modals without it.

### Stream drawer + confirm modal share the Escape key
**Where:** `streams/drawer/drawer.tsx` and the `Modal` primitive both attach a `keydown` Escape listener.
**Risk:** Deleting from inside the drawer opens the confirm modal *over* the drawer. One Escape press fires both listeners → cancels the delete **and** closes the drawer.
**Why we accept:** Both closing is a safe outcome (the destructive action is cancelled), and threading a `suppressEscape` prop down for a corner case isn't worth the coupling.
**Watch:** If we add more stacked overlays, build a small focus/escape stack manager instead of per-component listeners.

### Tables don't announce row count to screen readers
**Where:** `streams-table.tsx`, `apps/page.tsx`.
**Risk:** No `aria-rowcount` / `aria-busy`. Status pills are color-only; color-blind users rely on text.
**Mitigation in place:** Text alongside dots (`Healthy`, `Unhealthy`, `Preparing`, `Offline`, `Error`). The `StreamStatus` badge is never colour-only.
**Future:** Add `aria-busy` during fetches, `aria-rowcount` when known.

## Locked product decisions

Deliberate product decisions. Don't re-litigate them casually; reopen them only with the project owner.

- **Streams-table metric columns are NOT sortable.** The backend sorts only name/date/status
  (`DataStore.sortAndCropBroadcastList`); a mixed server-sort + client-page-sort model was
  rejected, and the live values reshuffle every poll anyway.
- **The stream drawer is metric tiles + one shared chart**, not the prototype's collapsible
  Overview/Quality/Viewers sections; per-protocol viewer *history* was dropped (Viewers is a
  single total line with a current-value protocol breakdown beneath). Don't "restore" either.
- **No manual Refresh buttons on auto-polling pages** (dashboard, apps list, streams/VoD
  toolbars). `refresh()` stays for mutations and error-retry banners; the Cluster page's
  refresh icon doubles as its fetch spinner and stays.
- **System-scoped user roles only** in the Users UI; the per-app `appNameUserType` matrix is
  preserved on the wire but not editable (V2).
- **The embedded player is an `iframe` of the app's own `play.html`**, not the
  `@antmedia/web_player` bundle (~5.5MB). The page negotiates the protocol itself; the panel only
  supplies `playOrder` and, on gated apps, a token.
- **Stream Import/Export round-trips definition fields only** (an allow-list in `stream-io.ts`),
  never runtime state. This is deliberately *not* a literal raw-`Broadcast` dump.
  Import posts the whole file to `POST /broadcasts/create-list`; duplicates are resolved
  server-side (fail / skip / overwrite), not by a client-side create loop.

## What we deliberately don't worry about

- **`window.location.origin` read in `media-origin.ts`**: read-only, and the single definition of where media lives. Every media URL (previews, `play.html`, VoD files, RTMP ingest) derives from `mediaOrigin()`; in dev it resolves to `VITE_BACKEND`, because vite proxies `/rest/v2` only and an iframe or `<img>` has to actually load. Don't reach for `window.location` in a url-builder again.
- **HashRouter "ugly" URLs**: admin panel, not public-facing. No SEO/OG concerns.
- **Mocks `import.meta.env.VITE_USE_MOCKS`**: production bundles strip mocks via tree-shaking. Verified in build output (mocks chunk only loaded when flag is set).
