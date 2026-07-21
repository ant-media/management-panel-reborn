// Build stamp baked into the bundle at build time by vite.config.ts (define). Read at runtime from
// the bundle, not fetched: there is deliberately no `/version.json` HTTP endpoint (a self-hosted
// server should not expose a clean version readout to scanners). The values are public regardless,
// and the same stamp also ships in the release zip. Surfaced in the gated Server Settings panel-info
// row.
declare const __PANEL_BUILD__: {
  version: string
  channel: string
  commit: string
  branch: string
  builtAt: string | null
}

export const panelBuild = __PANEL_BUILD__
