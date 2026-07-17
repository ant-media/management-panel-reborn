# UI kit: shared primitives

The reusable building blocks. **Reach for these before hand-rolling UI.** If you
catch yourself writing a bordered error box, a code chip, a sortable `<th>`, or a
selection `Set`, stop; it already exists here.

Rule: **when you extract or add a shared primitive, add a row to this file in the
same change.** This doc is the index that stops the next person from rebuilding it.

Two layers:
- `src/components/ui/`: tokenless atoms (shadcn-level).
- `src/components/shared/`: composed, domain-agnostic widgets (use design tokens).
- plus generic hooks/utils in `src/lib/`.

---

## By task: what to reach for

**An "are you sure?" dialog** → `ConfirmModal`, always. It owns the whole busy/error state
machine and the Cancel/Confirm footer, so your call site is just copy: a `DangerCallout` for the
warning and `TargetIds` for the id(s) being acted on. Give it `onConfirm: () => Promise<Result>`
and it reports failure inline itself. Two rules it exists to enforce: **mount = open** (render it
conditionally, `{target && <ConfirmModal …>}`, so every open starts fresh and no reset-on-open
effect is needed), and **never close on failure** (the user would lose the error and the retry).
Gate the confirm button with `canConfirm` (see the app-delete "type the name" case).

**Building any other dialog**
`Modal` (shell: backdrop, ESC, scroll-lock, focuses `[data-autofocus]`) + `Field`
(label + input + hint/error) + `FormError` (submit-error note). Never hand-roll the input, the
error box, or the warning. Edge-docked panels are different: the stream drawer is deliberately
bespoke, not `Modal` (Modal is centered-only), and owns its own ESC / scroll-lock / focus
handling. Don't fold it into `Modal`.

**A data table** (list with paging/sort/selection)
`SortableTh<K>` for sortable column headers, `Pagination` for the footer,
`ActionMenu` for the per-row `⋯`, `CopyChip` for inline copy-the-id, and
`useRangeSelection(orderedIds)` for checkbox + shift-click range select. See
`features/streams/streams-table.tsx` or `features/vods/vods-table.tsx` for the shape.

**Showing an identifier / code fragment**
`CodeChip` (an id you're acting on; dark-mode-safe fill) for prominent ids;
plain `<code className="font-mono">` only for inline code inside muted prose.

**A list filter box** → `SearchInput` (icon + input; `size` md=toolbar / sm=page header).
Pass layout (`flex-1`, `max-w-…`) via `className`. Never re-roll the icon+input markup.

**A failed page load** → `LoadErrorBanner` (`entity` + `error` + `onRetry`): non-blocking
"Could not load {entity}: …" + Retry. For modal-submit errors use `FormError` instead.

**A hover hint on a label** → `InfoDot` (`text`): tiny "i" with a tooltip. Sparse: only
for genuinely non-obvious settings/fields, never to narrate the obvious.

**A hover/focus popup on any element** → `Tooltip` (`content` + wraps the trigger): portaled,
`fixed`-positioned bubble that escapes table/drawer scroll-clip and auto-flips to stay
on-screen. Use for rich content (a diagnostics list, a preview) and **prefer it over native
`title=`**; `InfoDot` is just the narrow "i-on-a-label" case. Falsy `content` ⇒ trigger renders bare.

**Guarding a batched editor's unsaved edits** → `useUnsavedGuard(dirty)` (blocks in-app
route navigation + browser close, returns the router blocker) + `DiscardChangesModal`.
Non-route exits (local tab switches) can't be seen by the hook; gate those where the tab
state lives (see `features/apps/detail-page.tsx`).

**A status / type label** → `Pill` (tones: ok/warn/err/live/info/neutral).
**An ingest protocol tag** → `ProtocolBadge`.

**A list/page toolbar** → `Toolbar` + `ToolbarLeading` (search + filters) + `ToolbarActions`
(buttons). Handles the responsive wrap for you: regions stack into clean left-aligned
rows when width runs out. Never hand-roll a `flex … + flex-1 spacer` bar; that orphan-wraps.

**A page** → `Page` (header + body shell). Unbuilt route → `StubPage`.

**Charts / gauges** → `LineChart`, `Sparkline`, `Ring`/`DualRing`, `MeterBar` (thin
horizontal 0-100 bar, the inline counterpart to `Ring`, for GPU util / cluster CPU·mem).
Colour bars/rings with `threshColor(pct)` (the one shared 70/85 → ok/warn/danger ramp).
Strip Recharts chrome per AGENTS.md design ethos (no grid, muted axes, no tick animation).
`LineChart` is **responsive 1:1**: it measures its rendered width via `ResizeObserver` and
sets the `viewBox` to that width so 1 user-unit = 1px. **Do NOT add `preserveAspectRatio="none"`
with a fixed viewBox**: that stretches the coord space non-uniformly and squashes/fattens the
tooltip, axis labels and dots. New text/markers inside it are safe as-is.

**A viewer graph when the app's stats are off** → `StatsDisabledNotice` in the chart's place
when `writeStatsToDatastore` is false (counts read 0 → a flat-zero line would mislead). Caller
sizes it to the chart slot (`h-[84px]` / `h-[100px]`). Gated numbers nearby should show the `-` placeholder (what the `fmt*` helpers return for invalid input), not `0`.

**Persisting a bit of state** → `useStoredState(key, initial)` or the `storage`
object; never touch `window.localStorage` directly (Safari private mode throws).

**Copying text** → `copyToClipboard(value)` (secure-context aware, http fallback).

**Flashing a status** (uploaded / deleted / copied) → `useToast()` → `{ toast, flash, dismiss }`,
render `{toast && <ToastBanner toast={toast} onDismiss={dismiss} />}` at the top of the tab body.

**Formatting** → `fmtBytes` / `fmtCount` / `fmtBitrate` / `fmtDuration` / `fmtUptime`.

**Fetching** → a `use*` hook calling `useApi(fetcher, { pollMs, enabled, refetchKey })`
over `api` / `appApi(name)`. Components never call `fetch`. See ARCHITECTURE.md.

---

## Inventory

### `components/ui/`: atoms
| Component | Use it for | Notes |
| --- | --- | --- |
| `Button` | every button | `variant`: primary / outline / ghost / dangerOutline · `size`: sm / md / icon / iconSm |
| `Card` | panel surface | |
| `Checkbox` | checkbox | `onChange(next, event)`; `event` carries modifiers (shift for range-select) |
| `Icon` | all icons | `name` from the fixed set in `icon.tsx`; grep it before assuming a name exists |
| `Modal` | dialogs | `open / onClose / title / description / width(sm·md·lg·xl) / footer / headerActions (buttons before the close X) / dismissible`; focuses `[data-autofocus]`. Caps height to the viewport and scrolls its body with header/footer pinned, so tall content never pushes controls off-screen. `xl` (880px) exists for 16:9 media, e.g. the stream player |
| `Switch` | on/off toggle | |

### `components/shared/`: composed widgets
| Component | Use it for | Notes |
| --- | --- | --- |
| `Field` (`form.tsx`) | modal form input | label + input + hint/error; props: `required / optional / mono / tone('default'·'danger') / type('text'·'password') / autoFocus / error / hint` |
| `SelectField` (`form.tsx`) | modal dropdown | same label/hint/error shell as `Field`; `options: [value,label][]`. Use for enums (role, log level, SSL type); don't hand-roll a `<select>` |
| `FormError` (`form.tsx`) | modal submit error | danger-tinted note with icon; takes children |
| `CodeChip` | id / code chip | `--bg-3` + `--border-strong` so it survives dark mode (`--bg-2` collapses into the card) |
| `DangerCallout` | destructive warning | high-contrast banner; emphasis via `--danger` spans inside |
| `Pagination` | table footer | offset/pageSize/total; page sizes from `lib/page-size.ts` |
| `SortableTh<K>` | sortable column header | generic over the sort-key union |
| `ActionMenu` | row/header `⋯` menu, or any click-popover *menu* | `items: MenuItem[]` declared inline at the call site. `trigger` replaces the default `⋯` button: pass a *styled non-interactive* node (it gets wrapped in a `<button>` that owns the click + aria); that's how the settings warnings pill opens its list. Portaled + auto-flipping via `useAnchoredPosition`. For a popover that isn't a menu (combobox, rich panel), use the hook directly instead of contorting this |
| `useAnchoredPosition` (`use-anchored-position.ts`) | positioning any portaled popover | fixed pos vs a trigger ref: viewport clamp, flip-up, rAF tracking through resize + nested scroll; `matchWidth` for combobox panels (width follows the trigger, anchored left). Returns `null` until measured; render the panel `visibility: hidden` till then. Dismissal (outside-click / Escape) stays with the consumer |
| `CopyChip` | inline value + copy | dense table cells |
| `SearchInput` | list filter box | `size`: md (toolbar, 260px) / sm (page header, fluid); width/layout overridable via `className` (input is always `w-full`); `autoFocus` marks it for Modal's `[data-autofocus]` focus-on-open |
| `Toolbar` + `ToolbarLeading` + `ToolbarActions` | responsive list/page toolbar | two regions (search+filters / actions); `justify-between` row that stacks into clean rows when narrow; use it instead of a hand-rolled `flex + flex-1 spacer` bar |
| `LoadErrorBanner` | failed page-load banner | `entity` + `error` + `onRetry`; non-blocking, self-resolving |
| `InfoDot` | hover info tooltip | `text` (+ `size`); use sparingly, only genuinely non-obvious labels |
| `Tooltip` | hover/focus popup | generic portaled bubble: `content` (ReactNode) wraps any trigger; escapes scroll-clip, auto-flips, keyboard + `aria` wired. Reuse instead of native `title=` or hand-rolling another. `delay={0}` for controls in a dense table (a delay there reads as an unresponsive button). `focusable={false}` when the trigger is an enabled button: focus bubbles up anyway, so the wrapper's tab stop would just be a second stop on every row. Keep it focusable for inert content or a **disabled** button, which cannot take focus itself |
| `ConfirmModal` (`confirm-modal.tsx`) | every "are you sure?" dialog | owns busy/error + the Cancel/Confirm footer; the call site is only its copy. `onConfirm: () => Promise<Result>`, `errorFallback`, `confirmLabel`/`busyLabel`, optional `icon`, `canConfirm` (gate, e.g. type-the-app-name), `autoFocus: confirm \| cancel \| body`. **Mount = open**: render it conditionally so each open starts fresh (no reset-on-open effect, and `Modal` has no exit animation to preserve). **Never closes on failure**: the error lands inline so the user can retry. Body is a `<form>`, so Enter submits from a field |
| `TargetIds` (`confirm-modal.tsx`) | what a confirm acts on | one id inline, or a collapsed scrollable list for a bulk action |
| `Collapse` (`collapse.tsx`) | smooth height reveal | `open` toggles a grid-rows `0fr↔1fr` transition (no max-height guess / no measurement); honours `prefers-reduced-motion`. **Keep children mounted while closing** so the exit animates (unmounting → instant close), which is why closed content is `inert`: clipped children stay focusable otherwise, and you'd tab into an invisible form. Used by the dashboard detail panels and the stream drawer's sections |
| `DiscardChangesModal` | leave-with-unsaved confirm | pairs with `useUnsavedGuard`; "Keep editing" is the focused default |
| `Pill` | status/type label | tones: ok/warn/err/live/info/neutral; `dot` (+ optional `dotColor`/`pulse` overrides, e.g. a red on-air dot on a green health badge, as `StreamStatus` does) |
| `ProtocolBadge` | ingest protocol tag | WebRTC / RTMP / SRT / … |
| `Ring`, `DualRing` | gauge | dashboard capacities; `threshColor(pct)` for fill. `DualRing` `innerThickness` (thin) + small `gap` ⇒ a hero ring with a glued companion arc (secondary value shown as an arc, not a number) |
| `MeterBar` | inline 0-100 bar | thin track+fill; the inline counterpart to `Ring` (GPU/cluster meters). Clamps 0-100; pass `tone` (e.g. `threshColor(pct)`) + optional `className` (`flex-1`) |
| `Sparkline`, `LineChart` | trends | behind-the-number + full charts |
| `ExpandHandle` | "click to expand" affordance | the unified bottom handle for any card whose history opens below it (dashboard stat/meter cards, stream-drawer tiles): a thin `h-4` footer band (`--expand-bg`, recessed in both themes via dedicated tokens) + top hairline + centered chevron that rotates down→up when `open`. Band darkens on hover and **stays darkened while open**. Parent card must carry `group` + `overflow-hidden` (clips the band to the card radius) and supply the negative-margin inset via `className` (`-mx-4 -mb-4`, uniform `mt-2`). `line={false}` for a bare always-visible chevron (no band, e.g. overlaid on the drawer tiles); `growOnHover` scales it ~15% on hover and `size` tunes the glyph (default 13) since bare chevrons have no band to darken. Stretched grid cards need `flex flex-col` + a `flex-1` content wrapper, or the handle floats mid-card. Pair with the local `expandableProps(open,onClick)` helper to make a non-button `Card` an accessible `role=button` + Enter/Space + `aria-expanded` toggle |
| `StatsDisabledNotice` | viewer-graph "off" state | dashed box (eye-off icon + `CodeChip`) shown in a chart's place when an app's `writeStatsToDatastore` is off. Caller sizes it (`className="h-[84px]"`). Used by the dashboard app-row + stream-detail drawer |
| `ToastBanner` (`toast.tsx`) | transient status line | driven by `useToast()`; render at the top of the tab body |
| `Page`, `StubPage` | page shell / placeholder | `title` is **sr-only** (shown in the topbar breadcrumb already, not repeated visually); the header shows `subtitle` + `actions` only. Pass `title` for a11y; put visible context in `subtitle` |

### `lib/`: generic hooks & utils
| Export | Use it for |
| --- | --- |
| `useRangeSelection(orderedIds)` | table multi-select: `{ selected, select(id, shift), toggleAll, clear, remove }` |
| `useToast()` | transient status: `{ toast, flash(kind, msg), dismiss }` (pair with `ToastBanner`) |
| `useIsNarrow(max=640)` | responsive branch (drawer inline vs overlay) |
| `useViewportWidth()` (`use-viewport-width.ts`) | layout viewport width in CSS px; stable during in-page animations (only window resize / zoom changes it), so it's the right basis for a thresholded layout decision that must not flicker while a sidebar/panel animates |
| `useUnsavedGuard(dirty)` | block route-nav + browser-close while a batched editor is dirty; returns the router `Blocker` for a prompt |
| `useApi(fetcher, opts)` | the polling/abort fetch hook every `use*` builds on |
| `storage`, `useStoredState` (`localStorage.ts`) | safe localStorage (swallows private-mode/quota throws) |
| `copyToClipboard` (`clipboard.ts`) | clipboard with http fallback |
| `downloadFile` (`download.ts`) | client-side file save (blob + anchor); log download, streams/settings export |
| `parseJsonText` (`json.ts`) | `JSON.parse` for user-supplied text: BOM strip + line number in the error. Use for any pasted/uploaded JSON |
| `fmt*` (`format.ts`) | bytes / count / bitrate / duration / uptime |
| `PAGE_SIZE_OPTIONS`, `PageSize`, `DEFAULT_PAGE_SIZE` (`page-size.ts`) | list page sizes |
| `cn` (`utils.ts`) | `clsx` + `tailwind-merge` (later class wins on conflict) |
| `api`, `appApi(name)` (`api/client.ts`) | REST entry; `appApi` prefixes `/{name}/rest/v2` + attaches JWT |
| `Result`, `SimpleStat` (`api/types.ts`) | the REST envelopes the backend reuses |

---

## Not unified yet (candidates)
Honest list so the next person knows what's *not* a shared primitive yet:
- **Auth pages** (`features/auth/form.tsx`) keep their *own* `AuthField`/`FormError` on
  purpose: full-page treatment, not dialogs. Don't fold them into the modal kit.
- **`Tooltip`** hand-rolls its own hover positioning instead of using
  `useAnchoredPosition`. Works fine; migrate only if you're touching it anyway.
