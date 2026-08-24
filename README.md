# Ant Media Server Admin Panel Reborn

A ground-up rewrite of the Ant Media Server admin console. It replaces the old Angular panel with a
React app that talks to the AMS REST API. Run it against mock data with no backend, or point it at a
live server.

Built with Vite, React 19, TypeScript, Tailwind and shadcn/ui.

## Requirements

Node 20.19+ (24 recommended) and pnpm. pnpm comes from corepack, pinned to the version in
`package.json`, so you don't install it yourself.

Ubuntu:

```bash
sudo apt install -y nodejs npm
sudo corepack enable
```

Ubuntu 24.04 ships node 18, which is too old. Install a newer one with nvm or NodeSource first.

NixOS:

```bash
nix-shell        # gives you node and pnpm, see shell.nix
```

## Setup

```bash
pnpm install
```

That's it.

## Build

```bash
pnpm build       # type-checks, then writes a static site to dist/
```

`dist/` is a plain single page app. Serve it with nginx or any static file server.

Asset paths are relative and routing is hash based, so the same build runs from the web root or from
any subfolder. Moving it does not need a rebuild.

## Release

The panel ships inside Ant Media Server, not on its own. A release is one zip that you unzip over the
server's `webapps/root`.

Two layouts:

```bash
./release.sh                  # panel alone at the zip root, so it serves at /
./release.sh --with-legacy    # old console at /, this panel at /reborn-panel/
```

Then deploy it:

```bash
unzip -o panel-release-*.zip -x version.json -d <AMS>/webapps/root
```

`version.json` is a build stamp for CI. It is not web content, so keep it out of the server.

Real releases should come from CI, not from your machine. See [CI](#ci) below.

### Build with the legacy panel switcher

`--with-legacy` puts both panels in one zip. The old console keeps `/`, this panel goes to
`/reborn-panel/`, and both login pages get a pill that links to the other one. Same origin, same
session.

It clones the console from GitHub (branch `feature/reborn-panel-switcher`). Point it at a checkout
you already have and it builds that instead:

```bash
./release.sh --with-legacy ../Ant-Media-Management-Console
```

The switch pill is a build flag, not a runtime check. `--with-legacy` turns it on and every other
build leaves it off, because with no old console at `/` the pill would link to this panel itself.
Force it either way with `PANEL_SWITCH=on` or `PANEL_SWITCH=off`.

Other knobs: `RELEASE_VERSION`, `OUT_ZIP`, `PANEL_SUBDIR`, plus the `LEGACY_*` vars that
`build-legacy.sh` reads. Run `./release.sh --help` for the full list.

## Docker

The Dockerfile builds a preview image with mocks baked in, so it runs with no backend behind it.

```bash
docker build -t ams-admin-panel .
docker run -p 8080:8080 ams-admin-panel   # then open http://localhost:8080
```

## Dev

### Run it

```bash
pnpm dev          # mock mode, no backend needed, http://localhost:5173
pnpm dev-live     # live mode, proxies to a real AMS at http://localhost:5080
```

Point live mode at another server:

```bash
VITE_BACKEND=http://host:port pnpm dev-live
```

Mock mode serves canned data from `src/lib/api/mocks`, so the whole panel works offline. Live mode
proxies REST calls through Vite to a real server, so you log in and see real data. Only REST is
proxied, not thumbnails or VoD playback, so those fall back to placeholders in dev.

### Deploy to a local server

`redeploy.sh` builds the panel and drops it into `webapps/root/reborn-panel` on a server installed on
your machine. The legacy console next to it is left alone and the server process is not touched.

```bash
./redeploy.sh                                # defaults to ~/softwares/ant-media-server
AMS_DIR=/usr/local/antmedia ./redeploy.sh    # server somewhere else
```

This is the only setup that runs the panel behind the real backend, so it is how you test anything
that depends on the server, like the REST proxy or the IP filter. The login switch pill is on here,
since the old console is sitting right next to it. `PANEL_SWITCH=off ./redeploy.sh` drops it.

### Layout

| Path | What lives there |
|------|------------------|
| `src/features/` | One folder per area (dashboard, apps, streams, cluster, settings), each owning its pages, components, and hooks |
| `src/components/` | Shared UI. `ui/` holds the shadcn primitives, `shared/` the app-wide pieces |
| `src/lib/api/` | The data layer: endpoint catalog, wire-to-model transforms, and mocks |
| `docs/` | Architecture, API reference and design notes |
| `AGENTS.md` | Coding conventions and the docs map |

Components never call `fetch` directly. Every domain goes through a hook (`useStreams`,
`useServerStats`, and so on) that hides whether it polls or subscribes. That is what keeps the
mock-to-live swap a config flag instead of a rewrite.

### Working with agents

The project is built with agentic development in mind. The docs in `docs/` and the rules in
[AGENTS.md](AGENTS.md) exist so an AI agent can pick up the full project state on its own, without
anyone explaining it.

Open the project in Claude Code or similar and tell it something like *"we are devs on Ant Media
Server, please load up the project's knowledge"*. Wait for it to read the docs, then you are ready to
work.

Open work lives in [docs/dev-progress/TODO.md](docs/dev-progress/TODO.md), current state in
[STATUS.md](docs/dev-progress/STATUS.md). Agents pick work from the TODO, keep both files current,
and never pull future scope (V2) without approval. This setup is temporary. Once the V1 list is done
both files go away and tracking moves to GitHub issues.

## CI

GitHub Actions builds and publishes the zip. Every push refreshes that branch's snapshot at a fixed
URL, and releases are cut by hand from the Actions tab. AMS builds download the zip instead of
building the panels themselves.

To cut a release: Actions > "Release (draft)" > Run workflow, type the AMS version this panel ships
with, then publish the draft.

Snapshot URLs, the full runbook, cleanup and the build stamp: [docs/CI.md](docs/CI.md).
