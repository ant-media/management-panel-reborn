# CI and releases

How the panel gets built, packaged, and delivered to Ant Media Server. Everything runs on
GitHub Actions. You can build locally too, but real releases should come from CI.

The panel does not ship alone. One zip carries both panels: the legacy console at the web root
and this panel under `reborn-panel/`. AMS unzips it over `webapps/root`.

## How to release

Use CI. It builds from a clean checkout and stamps the exact commit, so the zip is reproducible.

Panel releases are tied to AMS releases: one panel release per AMS version, tagged the same
(`ams-vX.Y.Z`). The panel keeps no release version of its own; the AMS version you type overrides
`package.json`, so the tag, the zip name and the build stamp always carry the AMS version.

1. On GitHub: Actions > "Release (draft)" > Run workflow, type the AMS version this panel ships
  with (`3.1.0` or `ams-v3.1.0`; anything else fails the run right away).
2. A draft release `ams-vX.Y.Z` shows up in Releases page, with `panel-release-X.Y.Z.zip` attached
  and auto-generated notes.
3. Edit the notes if you want, hit Publish. That is when the git tag gets created.

Same AMS versions are never repeated; A fix goes into the next patch number.

## The two channels

- **Versioned releases** (`ams-v X.Y.Z`): cut by hand, steps above. The AMS release build with
the same tag pulls exactly this zip.
- **Branch snapshots** (`WORK-BRANCHES`): one long-lived pre-release holding one
`panel-<slug>.zip` per branch, replaced in place on every push. AMS dev builds pull these.

```mermaid
flowchart LR
    push([push to any branch]) --> snap[snapshot.yml]
    snap -->|one zip per branch, replaced| WB[WORK-BRANCHES pre-release]
    run([run workflow with AMS version]) --> rel[release.yml]
    rel -->|draft| pub[publish ams-v X.Y.Z]
    WB -->|dev builds| AMS[AMS CI]
    pub -->|release builds| AMS
```



## Branch snapshots

`snapshot.yml` runs on every push to every branch. It builds the full combined zip and uploads
it to the `WORK-BRANCHES` pre-release, overwriting that branch's previous zip. So the download
URL for a branch never changes:

```
https://github.com/ant-media/management-panel-reborn/releases/download/WORK-BRANCHES/panel-<slug>.zip
```

`slug` is the branch name with every character outside `[A-Za-z0-9._-]` turned into `-`. So
`feature/foo` becomes `panel-feature-foo.zip`, and master is `panel-master.zip`. A newer push
to the same branch cancels a still-running older build.

## Cleaning up old snapshots

Dead branches leave their zips behind. `cleanup.yml` handles that: run it by hand from the
Actions tab, pick an age (30/60/90/120 days, 120 default), and it deletes every `panel-*.zip`
on `WORK-BRANCHES` not updated in that long. `panel-master.zip` is never deleted.

## What's in the zip

Content-only, so it unzips straight over the server's `webapps/root`:

```
panel-release-<version>.zip
├── index.html, *.js, ...     legacy console (web root)
├── reborn-panel/             this panel
└── version.json              build stamp, CI only, do not deploy
```

Deploy by hand:

```bash
unzip -o panel-release-<version>.zip -x version.json -d <AMS>/webapps/root
```

## The build stamp

Every build carries a stamp: version, channel (DEV / SNAPSHOT / RELEASE), commit, branch, build
time. It lives in two places:

- `**version.json` at the zip root.** For CI: AMS reads it from the zip to spot a stale snapshot.
Excluded on deploy, so a running server never serves it.
- **Baked into the JS bundle** (`src/lib/panel-build.ts`), shown under Server Settings in the
"Panel" row.

There is deliberately no HTTP endpoint for it: a self-hosted server should not hand a scanner
its exact version in one request.

## Building locally

`./release.sh` does what CI does: builds the legacy console (`build-legacy.sh`), builds this
panel, writes the stamp, zips both.

```bash
./release.sh                 # full combined zip
./release.sh --skip-legacy   # this panel only, no legacy console in the zip
OUT_ZIP=my.zip ./release.sh  # custom output name
```

The stamp fields can be overridden with env vars (`PANEL_CHANNEL`, `PANEL_COMMIT`,
`PANEL_BRANCH`, `PANEL_BUILT_AT`); CI sets them, local builds fall back to git. Needs
node >= 20.19, pnpm, git and zip; on NixOS the script runs everything through `nix-shell`
on its own.

## The AMS side

AMS CI downloads the zip at build time instead of building the panels itself
(`.github/actions/build-projects/action.yml`, step `Fetch web panel`). Three tiers by branch:

- **Release tag** (`ams-vX.Y.Z`): the panel release with the same tag. Not published -> the
build fails with a message pointing back at the runbook above.
- **master**: `panel-master.zip` from `WORK-BRANCHES`.
- **Any other branch**: that branch's snapshot, but only if its `version.json` commit matches
the panel branch head. Stale or missing -> AMS clones the panel branch and runs `release.sh`
itself. No panel branch with that name, or the local build fails -> `panel-master.zip`.

`version.json` is always excluded on extract, so a running server never serves it.