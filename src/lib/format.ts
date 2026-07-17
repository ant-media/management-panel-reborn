const KB = 1024
const MB = KB * 1024
const GB = MB * 1024
const TB = GB * 1024

export function fmtBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes >= TB) return `${(bytes / TB).toFixed(digits)} TB`
  if (bytes >= GB) return `${(bytes / GB).toFixed(digits)} GB`
  if (bytes >= MB) return `${(bytes / MB).toFixed(digits)} MB`
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`
  return `${bytes} B`
}

export function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function fmtBitrate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '-'
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  if (bps >= 1_000) return `${Math.round(bps / 1_000)} kbps`
  return `${Math.round(bps)} bps`
}

// Stream-length style (1:02:45 / 4:12); keeps seconds, unlike fmtUptime.
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

// Magnitude-scaled stream uptime: <1m → "45s", <1h → "12m 45s", ≥1h → "1h 02m".
export function fmtStreamDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export function fmtUptime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// Coarse "time since" for heartbeats/last-seen (seconds → days).
export function fmtAgo(ts: number, now = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return '-'
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
