import path from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Live mode (VITE_USE_MOCKS=false): the panel makes same-origin REST calls, so the dev
// server proxies them to a real Ant Media Server. Mock mode never hits the network, so the
// proxy just sits idle. Backend URL: VITE_BACKEND (default localhost:5080).
const backend = process.env.VITE_BACKEND || 'http://localhost:5080'

// Panel build stamp, baked into the bundle (read via src/lib/panel-build.ts) and shown in the
// gated Server Settings panel-info row. release.sh exports these for real builds; plain
// `pnpm dev` / `pnpm build` fall back to a DEV stamp. The values are public (all bundle code is);
// what we deliberately DON'T ship is a queryable `/version.json` endpoint, so a self-hosted server
// never hands a scanner its exact version in one request. The same stamp also ships in the release zip.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))
const panelBuild = {
  version: process.env.RELEASE_VERSION || pkg.version,
  channel: process.env.PANEL_CHANNEL || 'DEV',
  commit: process.env.PANEL_COMMIT || 'dev',
  branch: process.env.PANEL_BRANCH || 'local',
  builtAt: process.env.PANEL_BUILT_AT || null,
}

export default defineConfig({
  define: {
    __PANEL_BUILD__: JSON.stringify(panelBuild),
  },
  // Served from a subfolder of the AMS root webapp (webapps/root/reborn-panel), so assets
  // must load relative, not from origin root. Safe because the router is hash-based and REST
  // paths stay origin-absolute (see docs/features/legacy-switcher.md).
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Management `/rest/v2/...` and per-app `/{app}/rest/v2/...` → the live backend.
      '^/([^/]+/)?rest/v2': { target: backend, changeOrigin: true },
    },
  },
})
