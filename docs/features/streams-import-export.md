# Spec: Streams Import/Export

Status: **shipped**. Frontend + one new backend endpoint.
Code: `src/features/streams/` (`stream-io.ts`, `import-streams-modal.tsx`, export wiring in
`app-streams-tab.tsx`) + shared `src/lib/json.ts`, `src/lib/download.ts`. Backend: bulk create in
the community `BroadcastRestService` (served in both editions), unit-tested.

## Wire contract

```
POST /{app}/rest/v2/broadcasts/create-list?onDuplicate={skip|overwrite}  → Result[]
```

Full contract in [API.md](../API.md) (Streams section). The parts that shape the UX: `onDuplicate`
omitted → **400 listing the conflicting ids, nothing created**; `skip` keeps existing streams;
`overwrite` deletes + recreates them (a live stream is force-stopped first). One `Result` per
stream, `message` = `created` | `skipped` | `overridden` | `failed`.

## Export (`stream-io.ts` + `app-streams-tab.tsx`)

- **Definition fields only, as an allow-list** (`EXPORT_FIELDS`: id, name, type, source
  URL/credentials, playlist, recording flags, endpoints, hook URL). Runtime state (viewer counts,
  bitrate, status, timestamps) is the server's to recompute. Allow-list, not a runtime blacklist:
  a new backend field can never silently leak into an export or an import payload.
- Export walks the **full paginated list** (selection survives paging, so the loaded page isn't
  enough). With rows selected it exports just those, no confirm; otherwise it confirms the
  full-app export first.
- Wrapper, the convention `settings-io.ts` also follows:

```json
{ "antmedia": "streams-export", "version": 1, "app": "...", "exportedAt": 0, "streams": [ ] }
```

## Import (`import-streams-modal.tsx`)

Three phases derived from state (pick / conflict / summary), reset is trivial:

1. **Pick**: parse the file (`parseImport`). Errors are specific: real JSON parse message with a
   line number (`parseJsonText`), "not a streams export" (naming the marker when it's some other
   AMS export), unsupported version, empty list. The parsed streams are **re-picked through the
   allow-list**, so hand-edited junk never reaches the create call.
2. **Conflict**: the first POST omits `onDuplicate`. On a 400 the server's message (listing the
   conflicting ids) is shown with two explicit choices: **Skip existing** or **Override existing**
   (danger-styled; the copy states that a live stream is stopped and recreated).
3. **Summary**: per-outcome counts from the `Result[]` (Created / Overridden / Skipped / Failed),
   then the table refreshes.

## Locked decisions

1. **Duplicates are resolved server-side, interactively.** No client-side pre-check: the
   omit-then-400 handshake is the source of truth, and nothing is created until the user picks a
   strategy (no partial imports from a conflicted first attempt).
2. **Export is definitions, not backups.** Re-importing gives fresh streams the server starts
   from scratch; it does not preserve runtime state or stats.

## Gotchas

- **Override is destructive**: delete + recreate, and a live stream is force-stopped. The button
  is danger-styled for a reason; keep it that way.
- **Keep `EXPORT_FIELDS` a definition allow-list.** Adding a runtime field breaks the export →
  import round-trip (the server rejects or misreads recomputed state) and leaks stats into files
  people share.
- An empty `streamId` in an imported entry auto-generates one (single-create semantics); ids only
  conflict when the file carries them.

## Related

- [app-settings.md](app-settings.md): the settings import/export mirrors this wrapper + modal
  convention, but is frontend-only (replaces the draft, no bulk endpoint).
