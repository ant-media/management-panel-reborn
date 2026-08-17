# AMS Admin Panel Reborn

Rewrite of the Ant Media Server admin panel. Replaces the legacy Angular console (the Ant-Media-Management-Console repo).

## Stack
Vite 8 + React 19 + TypeScript + Tailwind + shadcn/ui + Recharts. pnpm, pinned via `packageManager`.

## Docs map (source of truth)
Read STATUS + TODO before starting; consult the rest as the task dictates.
- **[docs/dev-progress/STATUS.md](docs/dev-progress/STATUS.md)**: where the project stands + the phase map.
- **[docs/dev-progress/TODO.md](docs/dev-progress/TODO.md)**: open work, split V1 / V2.
- **[docs/ui-kit.md](docs/ui-kit.md)**: shared UI primitives (Field, FormError, CodeChip, Pagination, useRangeSelection…). Check before building any UI.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: cross-cutting structure: the data/request layering, the two transports. Read before touching `src/lib/api/`.
- **[docs/API.md](docs/API.md)**: REST endpoints the backend exposes (verified against live 4.0.0 + Java; wire shapes in the appendix).
- **[docs/api-coverage.md](docs/api-coverage.md)**: `endpoints/` method ↔ REST ↔ mock ↔ consumer matrix; what's wired / catalog / mock-only.
- **[docs/RISKS.md](docs/RISKS.md)**: known gotchas, standing rules, locked product decisions.
- **[docs/features/](docs/features/README.md)**: design doc per shipped feature, incl. [backend-analytics.md](docs/features/backend-analytics.md) for the Java side.
- **[docs/CI.md](docs/CI.md)**: how the panel is built, released, and delivered to AMS (workflows, build stamp, release.sh).
- **[README.md](README.md)**: install, run (mock vs live), build. **[docs/README.md](docs/README.md)**: the docs index.

## Coding rules
Universal rules, any language, any repo area.

- **KISS + YAGNI.** Elegant and simple beats clever. Build what the task needs, not what it might need.
- **Reuse before rebuilding.** Grep for an existing helper, component, or pattern before writing a new one. Extend or compose; don't duplicate.
- **A minor refactor that genuinely improves the architecture while you're in there: do it.** Anything bigger: propose it first.
- **Comments**: minimal, compact, senior-to-senior. Minimal JSDoc. State only a non-obvious *why*, in the fewest words that carry it. Name things well so most comments are unnecessary; clean code beats comments explaining messy code.
- **Extraction must earn its name.** `const clamp0 = (n?: number) => Math.max(0, n ?? 0)` called 4 times is noise, not reuse. Extract for real logic or a real readability win. Three similar lines beat a helper that hides intent.
- **Unsure? Ask.** On a real ambiguity, stop and ask instead of assuming.
- **No em/en dashes, ever** (U+2014, U+2013): not in code, comments, UI copy, or docs. Use a comma, colon, parentheses, or plain hyphen. Check with `grep -rnP "\x{2014}|\x{2013}"`.

## Design ethos
**Apple-clean chrome, professional-dense data.**

- Generous whitespace at the page/section level. Tight rows inside data widgets; pro users scan a lot.
- Neutral grays everywhere. AMS red (`--accent`) only for: live indicators, destructive actions, the brand mark. Never as a fill for primary buttons.
- Geist sans + Geist Mono. Tabular figures for numbers.
- No gradients. No drop shadows beyond subtle elevation. No icon noise.
- Charts must look intentional (reference: Linear, Vercel, Tremor). Default Recharts styling is too playful: strip the grid, mute the axes, no animation on tick updates.
- Dense graphs and tables are wanted, not feared. Density reads as polished, not busy, when hierarchy, type scale, and spacing rhythm are correct.

## Project conventions
- **Folder layout**: feature-based. `src/features/<area>/` owns its page, sub-components, hooks. shadcn primitives live in `src/components/ui/`.
- **Data layer**: every domain has a hook (`useStreams`, `useServerStats`, etc.). The hook hides whether it polls or subscribes; components never call `fetch` directly. This is what makes the SSE swap trivial later.
- **Shared server state has one owner.** Before adding any poll, check whether a provider/hook already owns that data (e.g. `ApplicationsProvider` owns the apps list; read it, don't re-fetch it). See ARCHITECTURE.md *Shared server state*.
- **Polling has house conventions** (cadence by volatility, no flicker on poll ticks, mutations refresh immediately, non-blocking error banners). Read ARCHITECTURE.md *Polling conventions* before adding a fetch.
- **Placeholder data lives in the API/mock layer, never in hooks or components.** Don't seed, stub, jitter, or back-fill data in the frontend to make a view "look populated." Fake/demo data goes in `src/lib/api/mocks/*` behind a real endpoint shape; hooks just poll and render it. The bar: swapping mocks for a live server requires zero frontend changes. See ARCHITECTURE.md *Placeholder data*.
- **UI comes from the kit** (docs/ui-kit.md). Modals especially: `ConfirmModal` for any "are you sure?" (it owns busy/error + the footer; never re-roll that state machine), `Modal` + `Field` + `FormError` for everything else. Never hand-roll inputs or error boxes.
- **Componentize when files grow.** When a feature file passes ~300 lines or contains repeated visual chunks, split into sub-components co-located with the feature.
- **Don't add backwards-compat shims or feature flags.** This is a greenfield rewrite.
- **Auth**: server-session via HttpOnly cookie; API client uses `credentials: 'include'`; 401/403 redirects to `/login`. Router splits public vs protected layouts. See API.md + ARCHITECTURE.md.

## Hard invariants (breaking these = production bugs; context in docs/RISKS.md)
- App settings save POSTs the **whole fetched POJO** with edits merged. Never build the body from the visible/schema keys; a partial POST wipes the ~160 unsurfaced fields.
- Server settings are worse: a partial `POST /server-settings` **corrupts** (blanks `serverName`/`licenceKey`). Always re-POST the whole fetched object.
- Per-app REST goes through the backend proxy (`pushToBackendProxy` → `/rest/v2/request?_path=…`); apps IP-filter to `127.0.0.1`, so a direct `/{app}/rest/v2/...` call 403s from any browser. Management calls must stay direct; proxying them breaks login. See ARCHITECTURE.md *Backend proxy*.
- localStorage only through `storage` / `useStoredState` (`src/lib/localStorage.ts`). A raw `window.localStorage` call is a bug (Safari private mode throws).
- Backend (Ant-Media-Server) per-app metrics sampler: DB reads stay wrapped in `vertx.executeBlocking(..., ordered)`. A bare `setPeriodic` body blocks the event loop.
- Charts: never `preserveAspectRatio="none"` with a fixed viewBox on anything that draws text/markers (ui-kit.md, LineChart).
- Never change backend security behavior to fix panel compatibility; those fixes are frontend-only (hard project rule; RISKS.md, JWT lockout entry).
- The panel is served from a subfolder of the AMS root webapp with a relative asset base, not from the origin root. So REST paths stay origin-absolute (`/rest/v2/...`) and the router stays hash-based. Both are load-bearing (docs/features/legacy-switcher.md).
- The V2 line in docs/dev-progress/TODO.md is hard: never pull a V2 item into active work without explicit approval.

## Docs
Docs change in the **same commit as the code**, never as a follow-up. Stale docs are worse than none.

- **Write for the next reader, who is usually an LLM.** State the current contract and the intended next step. Nothing else: no change history, no "was X, then Y", no commit hashes, no staged/pushed status, no re-arguing a settled decision. Cut any sentence that doesn't change what someone does. Use the shortest wording that still survives being read cold. Dense beats thorough.
- **One home per fact.** Link instead of repeating. A detail that belongs in a feature doc gets summarised in one clause elsewhere, not restated.
- **Where it goes**: shipped → STATUS.md, and delete the TODO.md entry · deferred idea → TODO.md V2 · gotcha, standing rule, or locked decision → RISKS.md · feature design → docs/features/ · new shared primitive → a row in docs/ui-kit.md · cross-cutting structure (layers, transports, contexts) → ARCHITECTURE.md.
- Verification state (unverified / standalone-verified / cluster-verified) is real state: it lives in STATUS.md + TODO.md. A branch name is fine when it's the pointer someone needs; date it.

## Working with this repo
Ship in agreed chunks; stop and report after each so the user can test.
