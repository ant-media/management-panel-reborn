# Ant Media Server Admin Panel Reborn

A ground-up rewrite of the Ant Media Server admin console. It replaces the old Angular
panel with a React app that talks to the AMS REST API. You can run it against mock data
with no backend, or point it at a live server.

Built with Vite, React 19, TypeScript, Tailwind, and shadcn/ui.

## Requirements

Node 20.19+ (24 recommended) and pnpm.

Ubuntu:

```bash
sudo apt install -y nodejs npm
sudo corepack enable
```

If your distro ships Node older than 20.19 (Ubuntu 24.04 ships 18), install a newer one
with nvm or NodeSource first.

NixOS:

```bash
nix-shell        # provides node + pnpm, see shell.nix
```

pnpm itself comes from corepack, pinned to the version in package.json, so you don't
install it separately.

## Setup

After system dependencies have been installed, execute this:

```bash
pnpm install
```

## Run

```bash
pnpm dev          # mock mode, no backend needed, http://localhost:5173
pnpm dev-live     # live mode, proxies to a real AMS at http://localhost:5080
```

Point live mode at a different server:

```bash
VITE_BACKEND=http://host:port pnpm dev-live
```

Mock mode serves canned data from `src/lib/api/mocks`, so the whole panel works offline.
Live mode proxies REST calls through Vite to a real server, so you log in and see real
data. Only the REST API is proxied, not thumbnails or VoD playback, so those fall back to
placeholders in dev.

## Build

```bash
pnpm build        # type-checks, then writes a static site to dist/
```

Serve `dist/` with any static file server or nginx. It is a plain single-page app.

### Docker

The Dockerfile builds a standalone preview image with mocks baked in, so it runs without
a backend behind it.

```bash
docker build -t ams-admin-panel .
docker run -p 8080:8080 ams-admin-panel   # then open http://localhost:8080
```

## Development

The project is built with agentic development in mind. The docs in `docs/` and the rules in
[AGENTS.md](AGENTS.md) exist so an AI agent can pick up the full project state on its own,
without anyone explaining it.

The recommended flow: open the project in an LLM workspace (Claude Code or similar) and tell
it something like *"we are devs on Ant Media Server, please load up the project's knowledge"*.
Wait for it to read the docs, then you are ready to work.

Open work lives in [docs/dev-progress/TODO.md](docs/dev-progress/TODO.md), with the current
state in [STATUS.md](docs/dev-progress/STATUS.md). Agents are instructed to pick work from the
TODO, keep both files current, and never pull future-scope (V2) items without approval. This
setup is temporary: once the current TODO list is done, it gets removed and tracking continues
on GitHub issues as normal.

## Release

The panel ships inside Ant Media Server, not alone. AMS serves the old Angular console at the web
root and this panel from a subfolder beside it, sharing one login and origin. A release is one zip
with both, unzipped over the server's `webapps/root`.

Two scripts build it:

- `build-legacy.sh` clones the old console and builds it with the switcher on
- `release.sh` runs `build-legacy.sh`, builds this panel, and zips both (old console at the root,
  this panel under `reborn-panel/`) as `panel-release-<version>.zip`.

Both check their deps first, and run on plain Ubuntu and NixOS.

Build and deploy by hand:

```bash
./release.sh
unzip -o panel-release-*.zip -d <AMS>/webapps/root
```

### CI

GitHub Actions can build the zip too. Two workflows:

- **Snapshot** runs on every push to master. It updates one rolling pre-release (tag `snapshot`)
  with the latest build, at a URL that never changes, no login needed.
- **Release** you run by hand with a version like `2.4.3`. It makes a draft you edit and publish.

This lets AMS download the panel instead of building the Angular app itself.


## Layout

| Path | What lives there |
|------|------------------|
| `src/features/` | One folder per area (dashboard, apps, streams, cluster, settings), each owning its pages, components, and hooks |
| `src/components/` | Shared UI. `ui/` holds the shadcn primitives, `shared/` the app-wide pieces |
| `src/lib/api/` | The data layer: endpoint catalog, wire-to-model transforms, and mocks |
| `docs/` | Architecture, API reference and design notes |
| `AGENTS.md` | Coding conventions and the docs map |

Components never call `fetch` directly. Every domain goes through a hook (`useStreams`,
`useServerStats`, and so on) that hides whether it polls or subscribes. That is what keeps
the mock-to-live swap a config flag instead of a rewrite.
