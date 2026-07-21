# Docs

Reference for building and understanding the AMS admin panel. To get it running, start
with the root [README](../README.md). The docs here go deeper.

## Start here

- [dev-progress/STATUS.md](dev-progress/STATUS.md): where the project stands. What's shipped, verification state, what's next.
- [dev-progress/TODO.md](dev-progress/TODO.md): open work, split **V1** (current panel) / **V2** (future scope). Never pull a V2 item without explicit approval.

## Reference

Read these to build features and understand how the app fits together.

- [ARCHITECTURE.md](ARCHITECTURE.md): the data and request layering, and the two transports (mock and live).
- [API.md](API.md): the backend REST endpoints, verified against a live server and the Java source; captured wire shapes in the appendix.
- [api-coverage.md](api-coverage.md): which endpoint each API method maps to, its mock, and who consumes it.
- [RISKS.md](RISKS.md): known gotchas, standing rules, and locked product decisions.
- [ui-kit.md](ui-kit.md): the shared UI primitives. Check here before building anything new.
- [CI.md](CI.md): how the panel is built and released. The release how-to, branch snapshots,
  the build stamp, and what AMS downloads.

## Features

What the panel does, with a design doc per shipped feature that needed one.

- [features/](features/README.md): app settings, backend analytics, cluster view, server logs, streams master-detail, streams import/export, dashboard widgets, legacy panel switcher.

## Docs discipline

Short version; the full rules live in [AGENTS.md](../AGENTS.md).

- Docs describe the **current state**. No commit hashes or push status (git owns git state); no
  "was X, then became Y" narratives. Verification state (unverified / standalone / cluster) is
  real state and belongs in STATUS.md + TODO.md.
- One home per fact; link instead of repeating.
- When something ships: update STATUS.md, delete its TODO.md entry, extract lessons into
  RISKS.md and design notes into features/.
