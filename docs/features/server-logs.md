# Spec: Server Logs (Phase 13)

Status: **shipped**. Reads an existing backend endpoint; no new backend.
Code: `src/features/logs/` (`log-sources.ts`, `parse.ts`, `use-log-tail.ts`, `page.tsx`, `log-toolbar.tsx`, `log-console.tsx`, `log-row.tsx`) + mock `src/lib/api/mocks/logs.ts`.

## Decisions

1. **Own thin viewer**, not `react-lazylog` / `@melloware/react-logviewer` (raw-text engines that would throw away the parsed level/logger columns + per-level counts). `@tanstack/react-virtual` is skipped; the rendered window is small enough. Revisit if rendered row counts get large.
2. **Cluster node selector: deferred (TODO.md V2).** The data layer is built around a `LogSource` seam so per-node logs drop in later without touching the viewer. The Source selector is real today with two entries (Server log + Error log) and grows by adding sources.
3. **Live tail = simple periodic fetch + client-side reconciliation.** No SSE (backend has none). Re-fetch the tail window on an interval, diff against what we hold by stable line id, append only new lines: no flicker, scroll preserved. QOL on top: search, level filters with counts, auto-refresh toggle + interval, pause, follow-tail, line-wrap, download.
4. **Auto-refresh default**: on, 5s, follow-tail pinned to bottom. Interval select offers Off/2s/5s/10s; Pause is separate.
5. **Default source**: Server log (`ant-media-server.log`). Errors is one selector-click away.
6. **"Load older"**: tail-only today (`offset=-1`, last 256KB, reconcile); backward paging by decreasing byte offsets is deferred (TODO.md V2). See the head-trim caveat under Gotchas.
7. **Buffer cap**: default 1500, user-selectable in the toolbar (500 / 1k / 1.5k / 5k / 10k). Lowering it live-trims the held buffer.

## Backend reality

One endpoint, system-scoped (base `api` client, **not** `appApi`; this is not app-scoped):

```
GET /rest/v2/log-file/{offset}/{charSize}?logType=
  → { logContent: string, logContentSize: number, logFileSize: number }
```

- **Byte offset**, not line. `offset = -1` → tail the last `charSize` bytes. `charSize` capped at **512000** (500 KB) server-side.
- `logType=error` reads a **second real file** (`antmedia-error.log`); any other value reads `ant-media-server.log`.
- **Always send a `logType`.** A fully-absent param NPEs older servers (`logType.equals(...)` on null → HTTP 500), so `logs.file` defaults it to `'server'`. Current backend is null-safe (`LOG_TYPE_ERROR.equals(logType)`) but deployed servers still carry the bug.
- No server-side search, filter, or push. `logFileSize` is the lever for paging + change-detection.
- Source: `RestServiceV2.getLogFile` → `CommonRestService.getLogFile` in `Ant-Media-Server`.

**Log line format** is the logback pattern `%d{ISO8601} [%thread] %-5level %logger{35} - %msg%n` (`Ant-Media-Server/src/main/server/conf/logback.xml`), e.g.:

```
2026-05-11 23:08:40,123 [vert.x-eventloop-thread-1] INFO  io.antmedia.muxer.MuxAdaptor - Stream queue size: 0 ...
```

This maps 1:1 onto the parsed `LogEntry` shape below, so structured rows are genuinely parseable.

## Architecture

### Data layer (the expandability seam)

**`LogSource`**: identity + a fetcher. The one abstraction that makes "add cluster nodes later" a non-event.

```ts
interface LogSource {
  id: string                                   // 'server' | 'errors' | future: node id
  label: string                                // 'Server log' | 'Error log' | future: '10.0.0.5 · edge'
  fetchSlice(offset: number, charSize: number): Promise<LogSlice>  // { logContent, logContentSize, logFileSize }
}
```

- Two real sources over the same endpoint: `server` (default) and `errors` (`?logType=error`).
- Later, `nodeLogSource(node)` (hitting a per-node proxy) is just another entry in the list; the viewer never learns it's a cluster. Source construction lives in one factory (`log-sources.ts`) so node sources land there and nowhere else (deferred; TODO.md V2).

**`useLogTail(source, { charSize, pollMs, enabled })`**: owns polling + reconciliation. Built on the existing `useApi` polling idiom (abort-on-unmount, no-flicker poll ticks) but with a custom merge:

1. Periodic fetch of the tail (`offset = -1`, `charSize`) via `source.fetchSlice`.
2. **Change-gate:** remember last `logFileSize`; unchanged this tick ⇒ skip parse+diff entirely (zero work, zero flicker).
3. `parseLogback(raw)` → `LogEntry[]`.
4. **Reconcile by stable id** into the in-memory buffer. The sliding tail window overlaps what we already have, so merge by `id` and append only genuinely-new entries → stable React keys → append-only DOM → scroll preserved.
5. **Bounded buffer**: keep the last N entries (default 1500; see Decisions) so memory doesn't grow without limit on a long-lived tab.
6. `pause` / auto-refresh-off = `enabled: false`. Returns `{ entries, fileSize, isFetching, error, refresh }`.
7. Reset the buffer when `source.id` changes (switching Server↔Errors is a fresh stream).

**`parseLogback(raw): LogEntry[]`**

```ts
interface LogEntry { id: string; ts: string; thread: string; level: LogLevel; logger: string; msg: string; raw: string }
```

- Regex off the logback pattern: `^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d{3}) \[([^\]]+)\] (\w+)\s+(\S+) - ([\s\S]*)$` per line.
- `id` = stable hash of the raw line (content-addressed: survives re-fetch, dedupes the overlap).
- **Non-matching line ⇒ continuation** appended to the previous entry's `msg` (multi-line stack traces stay intact).
- **Trim the partial first line**: a byte-offset tail window almost always starts mid-line; drop everything before the first newline. Same for a truncated final line if the read was clamped.

### Presentation layer

- **`LogsPage`** (`src/features/logs/page.tsx`): orchestrator. Holds source selection + filter/search/view state; derives the visible list client-side (level filter + search) from `entries`.
- **`LogToolbar`**: uses the shared `Toolbar` / `ToolbarLeading` / `ToolbarActions` primitives (Phase 10/11) and the shared search input idiom.
- **`LogConsole`**: the scroll container. **Follow-tail** = auto-scroll only while pinned to bottom; the moment the user scrolls up, following stops and a **"jump to bottom"** pill appears (standard tail UX; avoids fighting the user's scroll).
- **`LogRow`**: parsed structured row `ts · LEVEL · [logger] · msg`, per-level left border + color (ERROR=`--danger`, WARN=`--warn`, INFO=`--info`, DEBUG dimmed), honors line-wrap toggle (`break-all` vs single-line + horizontal scroll).

### Toolbar / QOL

Source selector (Server / Errors) · search across msg+logger+thread with match highlight · ERROR/WARN/INFO/DEBUG filter chips **with counts** · auto-refresh toggle + interval (Off / 2s / 5s / 10s) · Pause/Resume · Follow-tail switch + jump-to-bottom · line-wrap toggle · **Download** (client-side blob of loaded text). View prefs (follow, wrap, interval, level set) persist via `useStoredState`.

## Gotchas

- **Byte-offset slicing cuts lines.** A tail window starts mid-line ~always; trim the partial head line or the first row is garbage. Don't assume the slice begins at a line boundary.
- **Reconcile, don't replace.** Re-rendering the whole window every tick flickers. Merge by content id; only new tail lines mount.
- **Multi-line entries.** Stack traces span many physical lines. A line that doesn't match the timestamp regex belongs to the previous entry; fold it in during parse, or filters/search/counts will treat trace lines as their own rows.
- **Counts/search are loaded-window only.** Labelled honestly ("in view"); they are NOT whole-file stats (no backend search). Same honesty rule as Phase 12's TLS tab.
- **`-1` vs explicit offset.** Use `offset = -1` for the steady tail. The change-gate compares `logFileSize` across ticks; only fetch+parse when it grew. (If "Load older" lands later, that path uses explicit decreasing offsets and must not disturb the tail buffer's head-trim.)
- **System endpoint, not app-scoped.** Goes through the base `api` client, not `appApi(name)`. No per-app JWT, no `/{app}/rest/v2` prefix.
- **Bounded memory.** A server tailing for hours produces a lot; the buffer is capped (see Decisions). Going past the cap deliberately is what "Load older" is for (deferred).

## Not in scope → TODO.md (V2)

- **Per-node cluster logs**: each node only serves its own `/log-file`; no proxy exists. The `LogSource` seam is ready; needs a backend proxy (see cluster.md).
- **Server-side search / level filter**: client-side over the loaded window only until a backend query API ships.
- **Real push (SSE/WebSocket)**: none server-side; we poll.
- **Server-side zip export**: no endpoint; "Download" saves loaded text. A real `/log-file/download` (full file / zip) would replace it.

## Implementation notes

- **Two-effect tail hook.** `useLogTail` splits the buffer **reset** (keyed on `[source]` only) from the **poll** subscription (keyed on `[source, charSize, pollMs, version]`). Critical: pause/resume and interval changes flip `pollMs`; if reset lived in the poll effect it would wipe the buffer and snap the scroll to bottom on every pause. Reset must fire only on a genuine source switch.
- **Stable ids.** `id = djb2(rawLine)` + an occurrence counter for exact-duplicate lines within a window. Continuation lines keep the parent entry's id, so folding a stack trace never changes the key.
- **Follow vs pinned.** Effective sticking = `follow && atBottom`. The Follow switch is the master toggle; `atBottom` (runtime, from the scroll handler) guards against yanking a user who scrolled up. The "Jump to latest" pill re-pins and re-enables follow.
