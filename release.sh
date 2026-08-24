#!/bin/bash
# Builds the reborn panel release zip. Two layouts:
#
#   ./release.sh                 panel alone at the zip root, so it serves at /
#   ./release.sh --with-legacy   legacy console at the root, panel in reborn-panel/,
#                                plus the switch pill on both login pages
#
# The zip is content-only (no WEB-INF/META-INF/images); extract it OVER an existing
# webapps/root, the same way dev deploys today.
#
# Config (all optional, env vars):
#   RELEASE_VERSION  version for the zip name  (default: version from package.json)
#   OUT_ZIP          output zip path           (default: panel-release-<version>.zip)
#   PANEL_SUBDIR     panel folder under --with-legacy   (default: reborn-panel)
#   PANEL_SWITCH     on|off, forces the login switch pill (default: on with legacy, else off)
#   plus what build-legacy.sh reads, --with-legacy only (LEGACY_BRANCH, LEGACY_DIR, ...)
#
# Flags:
#   --with-legacy [DIR]  also build the legacy console and give it the zip root. DIR builds
#                        that local checkout instead of cloning (same as LEGACY_DIR).
set -euo pipefail

cd "$(dirname "$0")"

# ---- config -----------------------------------------------------------------
VERSION=${RELEASE_VERSION:-$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)}
[ -n "$VERSION" ] || { echo "error: could not read version from package.json; set RELEASE_VERSION"; exit 1; }
OUT_ZIP=${OUT_ZIP:-panel-release-$VERSION.zip}
LEGACY_DIR=${LEGACY_DIR:-}
PANEL_SUBDIR=${PANEL_SUBDIR:-reborn-panel}
LEGACY_OUT=.legacy-dist
STAGING=.release-staging
# -----------------------------------------------------------------------------

usage() { awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; }
WITH_LEGACY=
while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --with-legacy)
            WITH_LEGACY=1
            # a path right after the flag is a local console checkout, build that instead of cloning
            case "${2:-}" in ''|-*) ;; *) LEGACY_DIR=$2; shift ;; esac
            ;;
        *) echo "error: unknown argument: $1"; echo; usage; exit 1 ;;
    esac
    shift
done

# LEGACY_* only mean something in the --with-legacy layout. Before the flag existed, LEGACY_DIR on
# its own picked the console to build, so honour that muscle memory instead of quietly handing back
# a panel-only zip under the usual release name.
if [ -z "$WITH_LEGACY" ] && { [ -n "$LEGACY_DIR" ] || [ -n "${LEGACY_BRANCH:-}" ]; }; then
    echo "error: LEGACY_DIR/LEGACY_BRANCH is set but --with-legacy is not, so no legacy console"
    echo "  would be built. Add --with-legacy, or unset them for a panel-only zip."
    exit 1
fi
export LEGACY_DIR

# The switch pill can only lead somewhere when the classic console ships beside the panel, so the
# layout picks the default and PANEL_SWITCH overrides it. Baked into the bundle by vite.config.ts.
PANEL_SWITCH=${PANEL_SWITCH:-$([ -n "$WITH_LEGACY" ] && echo on || echo off)}
case "$PANEL_SWITCH" in on|off) ;; *) echo "error: PANEL_SWITCH must be on or off, got: $PANEL_SWITCH"; exit 1 ;; esac
export PANEL_SWITCH

on_nix() { command -v nix-shell >/dev/null 2>&1 && [ -f shell.nix ]; }
nix_run() { if on_nix; then nix-shell --run "$1"; else bash -c "$1"; fi; }

banner() {
    local bar="=================================================="
    echo; echo "$bar"; echo "$bar"
    for line in "$@"; do echo " $line"; done
    echo "$bar"; echo "$bar"; echo
}

require() {
    local missing=()
    for c in "$@"; do command -v "$c" >/dev/null 2>&1 || missing+=("$c"); done
    if [ ${#missing[@]} -gt 0 ]; then
        echo "error: missing required tools: ${missing[*]}"
        echo "  Ubuntu/Debian: install via apt (node 22 via nvm or NodeSource; pnpm via 'corepack enable')"
        echo "  NixOS: run inside 'nix-shell'"
        exit 1
    fi
}

check_node() {
    local ver major minor
    ver=$(node --version | sed 's/^v//')
    major=${ver%%.*}; minor=$(echo "$ver" | cut -d. -f2)
    if [ "$major" -lt 20 ] || { [ "$major" -eq 20 ] && [ "$minor" -lt 19 ]; }; then
        echo "error: node $ver is too old; need >= 20.19 (node 22 recommended). Use nvm or NodeSource."
        exit 1
    fi
}

# git is needed by build-legacy.sh (clone). pnpm/zip/node come from shell.nix under nix;
# otherwise they must be on PATH, and one ambient node builds both panels, so require >= 20.19.
require git
if ! on_nix; then
    require pnpm zip node
    check_node
fi

echo "reborn release $VERSION"
if [ -z "$WITH_LEGACY" ]; then
    echo "  layout: panel at the zip root, no legacy console"
else
    echo "  layout: legacy console at the zip root, panel in $PANEL_SUBDIR/"
    if [ -n "$LEGACY_DIR" ]; then
        echo "  legacy: local checkout $LEGACY_DIR"
    else
        echo "  legacy: branch ${LEGACY_BRANCH:-feature/reborn-panel-switcher}"
    fi
fi
echo "  switch: $PANEL_SWITCH"
echo "  output: $OUT_ZIP"
echo

if [ -n "$WITH_LEGACY" ]; then
    banner "[1/3] Building legacy management panel."
    ./build-legacy.sh
    banner "Legacy management panel build done!" "[2/3] Starting reborn panel build."
else
    banner "[1/3] No legacy console in this build (--with-legacy adds it)." \
           "[2/3] Starting reborn panel build."
fi

# Build stamp values, computed once and shared: the `pnpm build` child (vite) bakes them into the
# bundle (shown in the Server Settings panel-info row) and they are written to the version.json
# below. Exported so the child sees them. Env-overridable; CI exports PANEL_* (SNAPSHOT + $GITHUB_SHA),
# local builds fall back to git.
export RELEASE_VERSION="$VERSION"
export PANEL_CHANNEL=${PANEL_CHANNEL:-RELEASE}
export PANEL_COMMIT=${PANEL_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}
export PANEL_BRANCH=${PANEL_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}
export PANEL_BUILT_AT=${PANEL_BUILT_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}

nix_run "pnpm install --frozen-lockfile && pnpm build"
[ -f dist/index.html ] || { echo "error: new panel build produced no dist/index.html"; exit 1; }

banner "Reborn panel build done!" "[3/3] Packaging release zip."
# assemble: with the legacy console it takes the root and the panel moves into a subfolder,
# without it the panel owns the root
rm -rf "$STAGING"
PANEL_DEST=$STAGING/root
if [ -n "$WITH_LEGACY" ]; then
    mkdir -p "$STAGING/root"
    cp -r "$LEGACY_OUT"/. "$STAGING/root"/
    PANEL_DEST=$STAGING/root/$PANEL_SUBDIR
fi
mkdir -p "$PANEL_DEST"
cp -r dist/. "$PANEL_DEST"/

# CI-only build stamp: NOT web content. Lives at the zip root so AMS reads it straight from the
# zip (`unzip -p <zip> version.json | jq -r .commit`) to check staleness, and the deploy extraction
# excludes it (`-x version.json`) so it never lands in a web-served path. The panel shows its own
# build info from the baked-in bundle constant (Server Settings), so there is no public endpoint.
cat > "$STAGING/root/version.json" <<EOF
{ "version": "$VERSION", "channel": "$PANEL_CHANNEL", "commit": "$PANEL_COMMIT",
  "branch": "$PANEL_BRANCH", "builtAt": "$PANEL_BUILT_AT" }
EOF
echo "  version.json (CI stamp, zip root): $VERSION / $PANEL_CHANNEL / ${PANEL_COMMIT:0:7}"

# zip the CONTENTS of root/ (content-only; unzips straight over webapps/root)
mkdir -p "$(dirname "$OUT_ZIP")"
rm -f "$OUT_ZIP"
ABS_ZIP="$(cd "$(dirname "$OUT_ZIP")" && pwd)/$(basename "$OUT_ZIP")"
nix_run "cd '$STAGING/root' && zip -qr '$ABS_ZIP' ."

if [ -n "$WITH_LEGACY" ]; then
    banner "Release done: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))" \
           "legacy console at /, panel at /$PANEL_SUBDIR/"
else
    banner "Release done: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))" "panel at /, no legacy console"
fi
echo "deploy: unzip -o $OUT_ZIP -x version.json -d <AMS>/webapps/root  (version.json is a CI-only stamp, not web content)"
