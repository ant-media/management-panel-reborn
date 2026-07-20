#!/bin/bash
# Builds the new panel and drops it into the reborn-panel subfolder of the AMS root webapp.
# The legacy console living in webapps/root is left untouched. Does not touch the server process.
set -e

cd "$(dirname "$0")"

AMS_DIR=${AMS_DIR:-$HOME/softwares/ant-media-server}
ROOT=$AMS_DIR/webapps/root
DEST=$ROOT/reborn-panel
SRC=dist

if [ ! -d "$ROOT" ]; then
    echo "No root webapp at $ROOT. Set AMS_DIR if your server lives elsewhere."
    exit 1
fi

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

if on_nix; then
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

# The new panel owns only the reborn-panel subfolder, so a clean wipe of just DEST is safe:
# the legacy console and its WEB-INF/META-INF sit next to it in root and are never touched.
echo "clearing $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"

echo "copying $SRC -> $DEST"
cp -r "$SRC"/. "$DEST"/

echo "done. panel deployed to $DEST"
