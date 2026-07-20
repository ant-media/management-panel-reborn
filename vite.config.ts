import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Live mode (VITE_USE_MOCKS=false): the panel makes same-origin REST calls, so the dev
// server proxies them to a real Ant Media Server. Mock mode never hits the network, so the
// proxy just sits idle. Backend URL: VITE_BACKEND (default localhost:5080).
const backend = process.env.VITE_BACKEND || 'http://localhost:5080'

export default defineConfig({
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
