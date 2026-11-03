#!/bin/bash
# Builds the new panel and drops it into the AMS root webapp. Everything else in webapps/root,
# the classic console in classic-panel/ included, is left untouched. Does not touch the server process.
set -e

usage() {
    cat <<USAGE
Usage: ./redeploy.sh [--no-build] [-h|--help]

Builds the panel and copies dist/ into \$AMS_DIR/webapps/root.

Options:
  --no-build   Skip install + build, deploy the dist/ already there (e.g. built on another
               machine). PANEL_SWITCH is baked in at build time, so it has no effect here;
               build with PANEL_SWITCH=on pnpm build to get the login switch pill.
  -h, --help   Show this help.

Environment:
  AMS_DIR       Server install (default: ~/softwares/ant-media-server)
  PANEL_SWITCH  on|off, the login switch pill (default: on if the server has classic-panel/)
USAGE
}

BUILD=1
for arg in "$@"; do
    case "$arg" in
        --no-build) BUILD=0 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $arg"; usage; exit 1 ;;
    esac
done

cd "$(dirname "$0")"

AMS_DIR=${AMS_DIR:-$HOME/softwares/ant-media-server}
ROOT=$AMS_DIR/webapps/root
SRC=dist

if [ ! -d "$ROOT" ]; then
    echo "No root webapp at $ROOT. Set AMS_DIR if your server lives elsewhere."
    exit 1
fi

# The login switch pill links to classic-panel/, so it is on only when the server has one.
# PANEL_SWITCH forces it either way (vite.config.ts bakes it in).
export PANEL_SWITCH=${PANEL_SWITCH:-$([ -f "$ROOT/classic-panel/index.html" ] && echo on || echo off)}
case "$PANEL_SWITCH" in on|off) ;; *) echo "PANEL_SWITCH must be on or off, got: $PANEL_SWITCH"; exit 1 ;; esac

on_nix() {
    command -v nix-shell >/dev/null 2>&1 && [ -f shell.nix ]
}

check_deps() {
    if ! command -v node >/dev/null 2>&1; then
        echo "node not found. Need node >= 20.19 (see README)."
        exit 1
    fi

    NODE_VER=$(node --version | sed 's/^v//')
    NODE_MAJOR=${NODE_VER%%.*}
    NODE_MINOR=$(echo "$NODE_VER" | cut -d. -f2)
    if [ "$NODE_MAJOR" -lt 20 ] || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 19 ]; }; then
        echo "node $NODE_VER is too old, need >= 20.19. Install a newer one with nvm or NodeSource."
        exit 1
    fi

    if ! command -v pnpm >/dev/null 2>&1; then
        if command -v corepack >/dev/null 2>&1; then
            echo "pnpm not found. Run: sudo corepack enable"
        else
            echo "pnpm and corepack not found. Install node >= 20.19 with corepack, then: sudo corepack enable"
        fi
        exit 1
    fi
}

if [ "$BUILD" = 0 ]; then
    echo "skipping build, deploying the existing $SRC"
elif on_nix; then
    echo "nix detected, building in nix-shell"
    nix-shell --run "pnpm install --frozen-lockfile && pnpm build"
else
    check_deps
    echo "building with node $(node --version), pnpm $(pnpm --version)"
    pnpm install --frozen-lockfile
    pnpm build
fi

if [ ! -f "$SRC/index.html" ]; then
    echo "build produced no $SRC/index.html"
    exit 1
fi

# The panel owns only the top-level entries its dist ships (index.html, favicon.png, assets/), so
# clear exactly those. WEB-INF, META-INF, images/, streams/ and classic-panel/ sit beside them.
echo "clearing the previous panel files in $ROOT"
for entry in "$SRC"/*; do
    rm -rf "${ROOT:?}/$(basename "$entry")"
done

echo "copying $SRC -> $ROOT"
cp -r "$SRC"/. "$ROOT"/

echo "done. panel deployed to $ROOT"
