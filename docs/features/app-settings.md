# Spec: App Settings editor + Import/Export (Phase 11)

Status: **shipped** (11-a advanced-field UX parked; TODO.md). Frontend-only: reads/writes the
existing settings endpoints, no new backend.
Code: `src/features/apps/` (`settings-schema.ts`, `settings-tab.tsx`, `settings-section.tsx`,
`settings-field.tsx`, `settings-warnings.tsx`, `settings-io.ts`, `import-settings-modal.tsx`,
`use-app-settings.ts`) + shared `src/lib/json.ts`, `src/lib/download.ts`.

## Backend reality (what we're building on)

```
GET  /rest/v2/applications/settings/{app}   → AppSettings (flat POJO, ~160 fields)
POST /rest/v2/applications/settings/{app}   → Result{success}
```

- Flat and whole: no grouping, no labels; the GET returns everything, the POST replaces
  everything. The whole-POJO re-POST invariant applies (RISKS.md).
- **Values are loosely typed on the wire.** Some numeric fields are Java `String` (`hlsListSize`
  is `"15"`), untouched fields arrive absent or `null`, and Jackson coerces leniently on save
  (`"true"` → `true`). The frontend mirrors that leniency instead of fighting it.
- The POST returns only `{success}`; settings aren't polled. The tab manages its own state
  instead of refetching.

## Architecture

### The schema overlay (`settings-schema.ts`)

The backend has no settings descriptor, so sections, labels, field types, defaults and
reveal/`showWhen` logic live in a frontend const (`SETTINGS_SCHEMA`). Keys are the REAL
`AppSettings` field names, verified against `AppSettings.java`. `getSettingsSchema(data)` is the
swap seam: when the backend grows a descriptor API, only that function's body changes.

Only a curated subset (~60 fields) gets a form row. **Everything else rides the draft verbatim**,
visible in the JSON drawer, never inspected or coerced.

### State model (`settings-tab.tsx`)

`baseline` = last loaded/saved server state; `draft` = live edits. Save POSTs the whole draft; on
success `baseline = draft` (no refetch). Discard restores baseline; nothing hits the server until
Save. The JSON drawer round-trips with the form and holds invalid text without touching the draft
(Save/Export disabled until it parses again).

**Dirty detection is canonical, not raw:** `canonEq` compares schema fields by interpreted value
(`canonValue`), so `"15"` vs `15` or absent vs typed default don't flag phantom "unsaved" marks.
Non-schema keys compare raw, except absent vs explicit `null` (wire-identical).

### Value semantics (`parseFieldValue`)

`parseFieldValue` is the ONE interpreter of raw wire values; controls, dirty marks, filters and
import previews all read through it (or `canonValue`/`isOn`/`isOff`). The authoritative contract
is the *Value semantics* comment in
[settings-schema.ts](../../src/features/apps/settings-schema.ts); the short version:

- Lenient the way Jackson is, per field type (`"true"` counts as a bool, `"15"` as a number).
- Junk is **never coerced or reset**: it displays the default, stays a visible change, gets a
  type-mismatch warning, and ships to the server unchanged. The server is the type authority.

### Safety net (`fieldStatus` + `WarningsMenu`)

One status per shown field, worst-first: type misfit → `required`/`strictLen` **errors** (a blank
or short secret would lock the app out; errors block Save with a red banner + jump-to-field) →
`FieldRule`s (cross-field checks, Enterprise-only warnings) → the soft `minLen` warning. Warnings
never block; they show on the row and aggregate in the toolbar pill. Rules are code, never
backend data.

### Import / export (`settings-io.ts` + `import-settings-modal.tsx`)

Wrapper mirrors the streams convention ([streams-import-export.md](streams-import-export.md)):

```json
{ "antmedia": "app-settings-export", "version": 1, "app": "...", "exportedAt": 0, "settings": { } }
```

- **Export = the current draft** (what you see), disabled while the JSON drawer holds invalid text.
- **Import replaces the draft**, it never merges. Accepts the wrapper or a bare `AppSettings`
  object; a streams export, wrong version, or non-object each get a specific error, and a parse
  failure shows the file's content with the real error message, never a bare "error".
- **`appName` is stripped on export AND on import**, the current app's name is re-injected on
  apply, so app A's file can never rename app B. The wrapper carries the source app as metadata.
- **The modal previews before applying**: how many settings change, how many are absent from the
  file (reset toward defaults), how many have no form row (inspect via Show JSON), and whether
  unsaved edits get replaced. Applying lands the changes as ordinary dirty marks with the "Only
  unsaved" filter on, so the review screen is the form itself; then one Save.

## Locked decisions

1. **Replace, not merge.** What you import is what you get; consequences are surfaced in the
   preview, not hidden.
2. **Never coerce junk values.** A type misfit displays the default, warns via the existing
   field-warning system, and ships as-is; the server decides. No silent resets.
3. **Dedicated import modal** (not the JSON drawer), so the parse-error and preview UX has room.
4. Accepted corner: junk on a `showWhen`-hidden field ships without a warning (`fieldStatus`
   skips hidden fields).

## Gotchas

- **Don't re-coerce locally.** Any new consumer of a raw settings value goes through
  `parseFieldValue`/`canonValue`/`isOn`; a local `Boolean(v)` or `Number(v)` reintroduces the
  display-vs-wire divergence this design killed.
- Schema `def`s must mirror the `AppSettings.java` initializers, including string-typed numbers
  like `def: '15'` (RISKS.md entry).
- Save can be blocked by imported values too: a file that turns on JWT with a blank secret trips
  the same `required` blocker as a manual edit. That's the point.

## Not in scope → TODO.md

- **Copy app settings on create** (V1).
- **Server settings import/export** (V2).
- **Server-tab phantom marks** (BUGS): the canon-compare pattern still needs porting there.
- **Phase 11-a**: advanced-field UX (the `advanced` flag is metadata only today).
