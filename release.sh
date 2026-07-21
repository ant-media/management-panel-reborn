#!/bin/bash
# Builds the combined reborn release zip: the legacy console (switcher build) at the web root
# plus the new panel under reborn-panel/. The zip is content-only (no WEB-INF/META-INF/images);
# extract it OVER an existing webapps/root, the same way dev deploys today.
#
# Config (all optional, env vars):
#   RELEASE_VERSION  version for the zip name  (default: version from package.json)
#   OUT_ZIP          output zip path           (default: panel-release-<version>.zip)
#   plus everything build-legacy.sh reads (LEGACY_BRANCH, LEGACY_DIR, FORCE_INSTALL, ...)
set -euo pipefail

cd "$(dirname "$0")"

# ---- config -----------------------------------------------------------------
VERSION=${RELEASE_VERSION:-$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)}
[ -n "$VERSION" ] || { echo "error: could not read version from package.json; set RELEASE_VERSION"; exit 1; }
OUT_ZIP=${OUT_ZIP:-panel-release-$VERSION.zip}
LEGACY_OUT=.legacy-dist
STAGING=.release-staging
# -----------------------------------------------------------------------------

usage() { awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; }
case "${1:-}" in -h|--help) usage; exit 0 ;; esac

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
if [ -n "${LEGACY_DIR:-}" ]; then
    echo "  legacy: local checkout $LEGACY_DIR"
else
    echo "  legacy: branch ${LEGACY_BRANCH:-feature/reborn-panel-switcher}"
fi
echo "  output: $OUT_ZIP"
echo

banner "[1/3] Building legacy management panel."
./build-legacy.sh

banner "Legacy management panel build done!" "[2/3] Starting reborn panel build."
nix_run "pnpm install --frozen-lockfile && pnpm build"
[ -f dist/index.html ] || { echo "error: new panel build produced no dist/index.html"; exit 1; }

banner "Reborn panel build done!" "[3/3] Packaging release zip."
# assemble: legacy at the root, new panel under reborn-panel/
rm -rf "$STAGING"
mkdir -p "$STAGING/root/reborn-panel"
cp -r "$LEGACY_OUT"/. "$STAGING/root"/
cp -r dist/. "$STAGING/root/reborn-panel"/

# zip the CONTENTS of root/ (content-only; unzips straight over webapps/root)
mkdir -p "$(dirname "$OUT_ZIP")"
rm -f "$OUT_ZIP"
ABS_ZIP="$(cd "$(dirname "$OUT_ZIP")" && pwd)/$(basename "$OUT_ZIP")"
nix_run "cd '$STAGING/root' && zip -qr '$ABS_ZIP' ."

banner "Release done: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))"
echo "deploy: unzip -o $OUT_ZIP -d <AMS>/webapps/root"
