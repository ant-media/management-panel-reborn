#!/bin/bash
# Builds the legacy Ant Media management console with the reborn panel switcher enabled and
# drops the result in ./.legacy-dist. This repo keeps no legacy source: the console is cloned
# (or pointed at with LEGACY_DIR) and built on demand.
#
# Config (all optional, env vars):
#   LEGACY_REPO    console git URL          (default: public HTTPS remote)
#   LEGACY_BRANCH  branch to build          (default: feature/reborn-panel-switcher)
#   LEGACY_DIR     build this local checkout instead of cloning (fast local iteration)
#   OUT_DIR        where to place the dist  (default: .legacy-dist)
#   FORCE_INSTALL  =1 to reinstall node_modules even if present
set -euo pipefail

cd "$(dirname "$0")"

# ---- config (defaults chosen so the script just runs) -----------------------
LEGACY_REPO=${LEGACY_REPO:-https://github.com/ant-media/Ant-Media-Management-Console.git}
LEGACY_BRANCH=${LEGACY_BRANCH:-feature/reborn-panel-switcher}   # TODO: switch to master after merge
LEGACY_DIR=${LEGACY_DIR:-}
OUT_DIR=${OUT_DIR:-.legacy-dist}
FORCE_INSTALL=${FORCE_INSTALL:-}
# -----------------------------------------------------------------------------

usage() { awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; }
case "${1:-}" in -h|--help) usage; exit 0 ;; esac

require() {
    local missing=()
    for c in "$@"; do command -v "$c" >/dev/null 2>&1 || missing+=("$c"); done
    if [ ${#missing[@]} -gt 0 ]; then
        echo "error: missing required tools: ${missing[*]}"
        echo "  Ubuntu/Debian: install via apt (node 22 via nvm or NodeSource)"
        echo "  NixOS: run inside 'nix-shell'"
        exit 1
    fi
}

# node >= 20.19 builds the panel; legacy also needs the openssl-legacy-provider flag, which
# the build:reborn script sets (valid on node 17+).
check_node() {
    local ver major minor
    ver=$(node --version | sed 's/^v//')
    major=${ver%%.*}; minor=$(echo "$ver" | cut -d. -f2)
    if [ "$major" -lt 20 ] || { [ "$major" -eq 20 ] && [ "$minor" -lt 19 ]; }; then
        echo "error: node $ver is too old; need >= 20.19 (node 22 recommended). Use nvm or NodeSource."
        exit 1
    fi
}

# git is always needed (clone). node/npm come from the clone's own shell.nix (node 22) when
# nix is present; with no nix at all they must be on PATH at a workable version.
require git
if ! command -v nix-shell >/dev/null 2>&1; then
    require node npm
    check_node
fi

# ---- obtain the source ------------------------------------------------------
CLONED=
if [ -n "$LEGACY_DIR" ]; then
    [ -d "$LEGACY_DIR" ] || { echo "error: LEGACY_DIR is not a directory: $LEGACY_DIR"; exit 1; }
    SRC=$(cd "$LEGACY_DIR" && pwd)
    echo "using local legacy checkout: $SRC"
else
    SRC=$(mktemp -d)
    CLONED=1
    echo "cloning $LEGACY_REPO ($LEGACY_BRANCH)"
    git clone --depth 1 --branch "$LEGACY_BRANCH" "$LEGACY_REPO" "$SRC"
fi
cleanup() { if [ -n "$CLONED" ]; then rm -rf "$SRC"; fi; }
trap cleanup EXIT

# ---- build ------------------------------------------------------------------
cmd="npm run build:reborn"
if [ ! -d "$SRC/node_modules" ] || [ -n "$FORCE_INSTALL" ]; then
    cmd="npm install && $cmd"
else
    echo "node_modules present, skipping install (FORCE_INSTALL=1 to override)"
fi

echo "building legacy console with the reborn switcher"
if command -v nix-shell >/dev/null 2>&1 && [ -f "$SRC/shell.nix" ]; then
    ( cd "$SRC" && nix-shell --run "$cmd" )
else
    echo "note: using ambient node ($(node --version 2>/dev/null || echo none)); legacy needs node 22"
    ( cd "$SRC" && bash -c "$cmd" )
fi

[ -f "$SRC/dist/index.html" ] || { echo "error: legacy build produced no dist/index.html"; exit 1; }

# ---- output -----------------------------------------------------------------
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -r "$SRC"/dist/. "$OUT_DIR"/
echo "legacy dist -> $OUT_DIR"
