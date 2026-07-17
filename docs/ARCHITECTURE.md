# Architecture notes

Living doc for cross-cutting structure. Add sections as patterns solidify.

> **API layer:** a named method-per-endpoint catalog (`src/lib/api/endpoints/`) sits between hooks and the client; mocks live at `src/lib/api/mocks/`. Coverage matrix: [api-coverage.md](api-coverage.md).

---

## Data / request layering

Every network call flows through the same stack, top to bottom. The point of the
split is that **components never touch `fetch`**, so the day polling swaps to
SSE (TODO.md V2), or mocks flip to a real server, nothing above the transport
line changes.

```
Component            e.g. the VoD tab, dashboard cards
   │ calls
use*() hook          useVods(), useBroadcasts(), useStreamDetail() …
   │ calls
endpoints/<domain>   ── named methods + stateless transforms ──   → src/lib/api/endpoints/*
   │ calls            broadcasts(app).list(), apps.info(), system.resources() …
api / appApi(name)   ── "api" layer ──            → src/lib/api/client.ts
   │ calls            (builds URL + attaches/​mints JWT; sends nothing itself)
transport.request()  ── "transport" layer ──
   │ which is ONE of (picked by VITE_USE_MOCKS):
   ├── FetchTransport   real fetch() → live Ant Media Server  → transport.ts
   │                    (app calls tunneled via the backend proxy; see below)
   └── MockTransport    fake, canned data, no network         → mock.ts + src/lib/api/mocks/*
```

### What each layer is responsible for

| Layer | File | Job |
| --- | --- | --- |
| **hook** (`use*`) | `src/features/*/use-*.ts` | Owns polling, abort-on-unmount, rolling buffers, derived view state. The only thing components call. **Never synthesizes data**; see *Placeholder data* below. |
| **endpoints** | `src/lib/api/endpoints/*` | Named method per REST endpoint + its **stateless** wire→model transform (unwrap `{number}`, `{applications}`…). Per-app = factory `broadcasts(app)`; management = object `apps`. The catalog hooks call (see [api-coverage.md](api-coverage.md)). Adding one: mirror an existing file. |
| **api** (`api` / `appApi`) | `src/lib/api/client.ts` | Builds the URL (`/{app}/rest/v2/...`) and resolves app auth: a pasted `{app}jwtToken` or one **minted client-side** from the app secret (`app-jwt.ts`) on a 403. App 403 ⇒ mint+retry (not logout); management 401/403 ⇒ logout. Marks app calls `pushToBackendProxy`. Wraps `transport` in a debug logger (`ApiError` carries `.status` + `.body`; aborts + `quiet` calls excluded: `quiet` marks mock-only endpoints whose 404 against a real backend is expected). |
| **transport** | `transport.ts` / `mock.ts` | The thing that actually moves bytes. Two interchangeable implementations behind the `Transport` interface; `VITE_USE_MOCKS` picks one at startup. `FetchTransport` is the only layer that knows about the backend proxy. |
| **mocks** | `src/lib/api/mocks/*.ts` | Canned-data handlers `MockTransport` matches URLs against. The "emulation." Lazy-loaded, tree-shaken out of production. |

### Two transports, one interface

- **`FetchTransport`**: the **real** one. Calls the browser's `fetch()` against a
  live server, sends `credentials:'include'`, normalises errors to `ApiError`,
  routes 401/403 to the auth-failure listener **unless `suppressAuthEmit` is set**
  (app calls set it; a JWT 403 there means "mint a token", not "session dead").
  This is what ships to production.
- **`MockTransport`**: the **fake** one. No network; pattern-matches the path
  against `registerMock(...)` handlers in `src/lib/api/mocks/*` and returns made-up data.
  Dev runs with this ON by default (`VITE_USE_MOCKS=true`).

Both are handed the same **canonical** path: the `/rest/v2` (or `/{app}/rest/v2`) prefix is
baked in at the `client.ts` call site, so the mock router pattern-matches the exact
path the endpoint catalog documents. That's what keeps the two halves honest.
`FetchTransport` rewrites app paths onto the backend proxy as its last act before `fetch()`;
nothing above it (mocks, endpoints, the debug logger) ever sees the proxied URL.

> Naming gotcha: "the api layer" (`appApi`) is **not** "the
> emulation." `appApi` is the real URL/JWT helper and always runs. The emulation
> is `MockTransport` + `src/lib/api/mocks/*`. When we say "our transport only speaks JSON,"
> we mean **`FetchTransport`** specifically: the real HTTP sender.

### Backend proxy: the only route to per-app REST

Every app IP-filters `/{app}/rest/v2` to `remoteAllowedCIDR` (default `127.0.0.1`;
`ipFilterEnabled` default on), so a browser gets `403 "Not allowed IP"` on every direct app
call. `FetchTransport` therefore rewrites them onto root's proxy servlet
(`webapps/root/WEB-INF/web.xml` → `targetUri=http://localhost:5080/{_path}`), which re-issues
the request from the server itself. `appApi` sets `pushToBackendProxy`; only `FetchTransport`
acts on it.

```
/LiveApp/rest/v2/broadcasts/list/0/25?sort_by=date            canonical (everything above the transport)
/rest/v2/request?_path=LiveApp%2Frest%2Fv2%2F…&sort_by=date   the wire URL FetchTransport sends
```

`_path` is encoded a second time over the segment encoding `endpoints/` already applies: the
servlet decodes it exactly once before building the target URI, so a stream id holding a space
or `$` survives (the legacy console concatenated raw and 500s on those). Query params are
forwarded; bodies stream through untouched, so multipart VoD upload works.

**Management calls are never proxied**, and can't be: `AuthenticationFilter` authorizes them off
the *outer* request URI and exempts the bootstrap endpoints (`users/authenticate`,
`authentication-status`, `first-login-status`, `users/initial`) by exact match; proxying
collapses that URI to `/rest/v2/request`, which demands a session, so login could never happen.
The same filter reads `_path` to scope-check the app call, so proxying *restores* the per-app
role enforcement that direct calls silently bypassed.

The app's `Authorization` header rides through untouched (AMS reserves `ProxyAuthorization` for
the console so the two realms never collide), so the app JWT below still applies. Inherited
limits (the legacy console shares this servlet) are in [RISKS.md](RISKS.md).

### App JWT: minted client-side (`app-jwt.ts`)

A JWT-protected app 403s the console session (separate auth realm, verified). So the
panel authorizes app calls itself: a user-pasted `{app}jwtToken` wins; otherwise, **on the
403**, `appApi` reads the app's `jwtSecretKey` (admin-readable via management settings) and
mints a short-lived **HS256** token with the Web Crypto API, then retries once and caches it
(5-min TTL, in memory). AMS's `JWTFilter` validates signature + `exp` only; no required
claims (verified against a live server). It is not IP-based, so the backend proxy above
neither bypasses nor disturbs it.

**Lazy by design:** open apps never pay (no 403, no mint, no settings read). `ensureAppToken`
returns the token already held instead of re-minting and collapses concurrent mints onto one
secret read; `withJwt` skips the retry when the token it would resend is the one that just
failed. So a 403 no token can fix (a rejected pasted token, a dead session, a blank secret)
costs at most one settings read, not one per call per poll. `mint()` never throws: it yields
`null` and the honest 403 reaches the caller.

**Web Crypto is secure-context-only.** `crypto.subtle` is `undefined` on a plain-HTTP origin
(localhost excepted), so a panel served over HTTP cannot mint at all; a JWT-protected app then
needs a pasted `{app}jwtToken`, or TLS. The secret entering the browser is a known tradeoff
either way; the clean replacement is a backend mint endpoint, tracked in
[TODO.md](dev-progress/TODO.md) V2.

### Deployed next to the legacy console

The panel does not own the origin root. It ships as a static folder inside the AMS root webapp
(`webapps/root/reborn-panel/`), with the old Angular console still at `/`. Same webapp, same
origin, same `JSESSIONID` (root's context path is `""`, so the cookie path is `/` and covers the
folder). Log in once and both panels see the session.

Nothing routes. Both panels use hash routing, so the server only ever sees the two static paths.
Switching panels is a `window.location.href`, not a route.

The build is folder-agnostic (`base: './'`, relative assets), which only works while three things
stay true. Treat them as invariants: HashRouter, origin-absolute REST paths, and `mediaOrigin()`
reading `window.location.origin`.

The session is shared for free. Identity is not: the backend has no "who am I" endpoint, so only the
panel that performed the login knows who you are. The old console hands it over in a localStorage
key. Contract and reasoning: [features/legacy-switcher.md](features/legacy-switcher.md).

### Shared server state: one owner

Widely-consumed server state gets ONE owner; consumers read it, they don't re-fetch it.
The worked example is the applications list: `ApplicationsProvider` (mounted once in
`ProtectedLayout`; `src/features/apps/use-applications.tsx`) owns the single 15s poll, and the
sidebar, the dashboard apps card, and the `/apps` page all read it through `useApplications()`.
Mutations go through the same owner (`create`/`remove` call the API, then `refresh()`), so every
consumer sees the change at once; deletes keep an optimistic overlay (a pending-names set) so a
deleted row vanishes immediately instead of reappearing until the next poll.

The rule when a new widget needs data: check whether a provider/hook already owns it before
adding a poll. A second `useApi` poll for the same data means duplicate traffic and two copies
that disagree mid-cycle. Page-local state (one table's list with its own pagination/search)
stays in a page-local hook; "one owner" is for state consumed across the app chrome.

### Polling conventions

There is no SSE/WebSocket; polling is the transport. House rules:

- **Cadence follows volatility.** Live stream lists 5s; stream detail 2s; dashboard
  `system-resources` 5s; cluster 5s (the node heartbeat period); VoD 10s; applications list
  15s. A new endpoint picks the nearest neighbor, not a fresh number.
- **Poll ticks never flicker.** `useApi` distinguishes `isLoading` (nothing to render yet, show
  the empty/skeleton state) from `isFetching` (a request is in flight, keep rendering the old
  data). Never key a spinner or a remount off a poll tick.
- **Mutations refresh immediately.** After a create/delete/update, call the owning hook's
  `refresh()`; don't wait for the next tick.
- **Page errors are non-blocking.** A failed poll shows `LoadErrorBanner` while polling keeps
  running, so the banner self-resolves. Decorative data (history charts) stays out of the
  page-level error entirely and degrades to an empty chart.

### Connection status

The topbar pill shows live backend reachability and a slim banner covers outages. Every request
outcome doubles as a reachability signal, so any active page detects a drop on its own traffic: a
response (even an error status) reads as connected, a network failure as disconnected. While
disconnected, a 10s loop retries and drives the banner countdown, then either resumes silently
(session still valid) or logs out through the normal auth path (session gone). An outage alone
never logs the user out; only an invalidated session does, so surviving a real backend restart
depends on the server persisting the session.

### Placeholder data is the mock layer's job

The frontend renders what the data layer returns; it never fabricates, seeds, or
back-fills data to "look populated." Anything not real (demo history, jittered live
values, synthetic series) lives in `src/lib/api/mocks/*` behind a real endpoint shape. The
test: deleting the mock and pointing at a live server must need **zero** changes
above the transport line.

Worked example: dashboard metric history. The charts read `GET /system-resources/history`
(`DashboardHistory` = `Record<HistoryKey, number[]>`); the backend serves it live, and a
moving-window generator in `src/lib/api/mocks/dashboard.ts` serves offline dev. The hook
just polls and renders it; there is no client-side accumulation or first-load seeding.
History is treated as **decorative**: its error is excluded from the dashboard error banner, so
a missing endpoint degrades to empty charts instead of a page-level failure.

### Presentation metadata: inject at the data layer, behind a swap seam

Some backends return *less* structure than the UI needs: not fake data, but missing
**metadata**. `AppSettings` is the case: the backend returns a flat POJO (key → value)
with no notion of sections, labels, or which fields are "advanced". That grouping is a
frontend concern *today* but a backend one *eventually*.

Rule: when the frontend supplies metadata the backend will later own, inject it at the
**data layer** from a clearly-isolated const (never bake it into the component), so the
day the backend ships it, you delete the const and the component never moves.

Worked example: settings categories. `settings-schema.ts` holds a hardcoded
`SETTINGS_SCHEMA` (sections + per-field label/type/default/hint/advanced, keyed by real
`AppSettings` field names). `getSettingsSchema(data)` is the **swap seam**: today it ignores
`data` and returns the const; tomorrow it reads `categories` off that response and is the only
thing that changes; the call site already passes `data`, so even the signature stays put. The
component (`settings-tab.tsx`) renders whatever sections it's handed and holds a draft = the
**whole** fetched POJO, so a Save POSTs every field back: the ~160 fields the editor doesn't
surface ride along untouched (verified by non-schema keys in the mock). A successful save sets
`baseline = draft` and does **not** refetch: settings aren't polled and the POST returns only
`{success}`, so a refetch would buy nothing and could clobber an edit started before it lands. Defaults live in the schema too (no defaults endpoint exists, and reset-to-default
needs them); they're field *definition*, not faked current-values, so the *Placeholder
data* rule above is not violated; only `value` ever crosses the API line.

This is distinct from the mock layer: the schema runs in **both** mock and live modes (it's
metadata, not emulation). The mock still returns only the raw flat POJO, exactly as the real
backend does.

Swap caveat: field *grouping, labels, types, and defaults* port cleanly from a future backend
descriptor, but the predicates are **code**: the conditional-reveal `showWhen` and the
validation `rules` would stay frontend (or move to a declarative `{field, equals}` form) rather
than arriving as data. Plan the descriptor shape with that in mind.

### Settings validation: one status per field, two severities

`fieldStatus(field, draft, ctx)` returns at most one `{ error }` or `{ warning }` per field, and
`settings-tab.tsx` makes one pass over the schema to build them. An **error** blocks Save and is
listed in the red banner (only lock-you-out configs qualify; see RISKS.md); a **warning** never
blocks and is collected into the toolbar's warnings menu. Both render inline under their row, for
every control type, and both jump-and-scroll to the row via its `data-field` anchor.

Three kinds of check feed it, worst-first: the declarative shorthands `required` / `strictLen`
(errors), then `rules` (a `when(draft, ctx)` predicate, so a field can depend on any other field
or on server context like the edition probe), then the soft `minLen` (warning). Nothing is
evaluated while `showWhen` hides the field, so a status can never point at an unreachable row.
`ctx.enterprise` is `null` until `GET /enterprise-edition` answers; rules must read unknown as
"stay quiet" rather than guess.

Rules that generalise get a named factory at the top of `settings-schema.ts`, next to `on(key)`.
`requiresEnterprise(key)` is the first: it warns when `key` is switched on against a Community
build. Compose them into a field's `rules`; first match wins, so put the most fundamental cause
first (edition before configuration).

### Request bodies: JSON + multipart

`FetchTransport` has two body strategies. **JSON** (default): set
`Content-Type: application/json` and `JSON.stringify(body)`; covers every small-object
call. **Multipart** (VoD upload): when the body is a `FormData`,
*don't* set `Content-Type` (the browser must set `multipart/form-data; boundary=…`
itself) and pass the `FormData` straight through; `JSON.stringify(file)` produces
`"{}"`, so a file can't ride the JSON path.

```js
const isForm = options.body instanceof FormData
if (hasBody && !isForm) headers['Content-Type'] = 'application/json'
...
body: hasBody ? (isForm ? options.body : JSON.stringify(options.body)) : undefined
```

Backend contract (`VoDRestService.uploadVoDFile`): `POST /{app}/rest/v2/vods/create?name={fileName}`,
`@Consumes MULTIPART_FORM_DATA`, file part named `file`, optional `metadata` part.
This is the same multipart the old Angular panel used; nothing exotic.
