#!/bin/bash
# Builds the panel and drops it into the AMS root webapp. Does not touch the server process.
set -e

cd "$(dirname "$0")"

AMS_DIR=${AMS_DIR:-$HOME/softwares/ant-media-server}
DEST=$AMS_DIR/webapps/root
SRC=dist

# WEB-INF holds the console REST servlet config, META-INF the tomcat context. Wiping them
# kills the backend the panel talks to, so they survive every redeploy.
KEEP=(WEB-INF META-INF)

if [ ! -d "$DEST" ]; then
    echo "No root webapp at $DEST. Set AMS_DIR if your server lives elsewhere."
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

# Keep a copy of whatever was there before the first redeploy, so the stock Angular panel
# is recoverable without reinstalling the server.
BACKUP=$AMS_DIR/root-original-backup
if [ ! -d "$BACKUP" ]; then
    echo "backing up current root webapp to $BACKUP"
    cp -r "$DEST" "$BACKUP"
fi

echo "clearing $DEST (keeping ${KEEP[*]})"
FIND_ARGS=()
for k in "${KEEP[@]}"; do
    FIND_ARGS+=(-name "$k" -o)
done
find "$DEST" -mindepth 1 -maxdepth 1 \( "${FIND_ARGS[@]}" -false \) -prune -o -exec rm -rf {} +

echo "copying $SRC -> $DEST"
cp -r "$SRC"/. "$DEST"/

echo "done. panel deployed to $DEST"
