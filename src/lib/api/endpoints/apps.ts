import { api } from '../client'
import type { Result } from '../types'
import type { ApplicationInfo } from '@/features/apps/use-applications'
import type { AppSettings } from '@/features/apps/use-app-settings'

const id = (v: string) => encodeURIComponent(v)

// Management apps surface (console scope, `/rest/v2`).
export const apps = {
  // GET /applications → { applications: string[] }; unwrap to the names.
  names: (signal?: AbortSignal) =>
    api.get<{ applications: string[] }>('/applications', { signal }).then(r => r.applications ?? []),
  info: (signal?: AbortSignal) =>
    api.get<ApplicationInfo[]>('/applications-info', { signal }),
  // Default create is a plain POST (JSON); a custom app rides as a multipart PUT
  // with the packaged WAR (`file`) + its filename (`file_info`). Mirrors the backend
  // (POST @Consumes JSON / PUT @Consumes multipart) and the legacy console.
  create: (name: string, warFile?: File | null) => {
    if (warFile) {
      const form = new FormData()
      form.append('file', warFile)
      form.append('file_info', warFile.name)
      return api.put<Result>(`/applications/${id(name)}`, form)
    }
    return api.post<Result>(`/applications/${id(name)}`, {})
  },
  remove: (name: string, deleteDB: boolean) =>
    api.delete<Result>(`/applications/${id(name)}`, { query: { deleteDB } }),
  reset: (name: string) =>
    api.post<Result>(`/applications/${id(name)}/reset`),
  liveStreams: (name: string, signal?: AbortSignal) =>
    api.get<unknown[]>(`/applications/live-streams/${id(name)}`, { signal }),

  // ── Settings (flat POJO; whole-object re-POST; see settings-schema.ts) ─────
  getSettings: (name: string, signal?: AbortSignal) =>
    api.get<AppSettings>(`/applications/settings/${id(name)}`, { signal }),
  saveSettings: (name: string, settings: AppSettings) =>
    api.post<Result>(`/applications/settings/${id(name)}`, settings),

  // Per-app metric history: in-memory ring on the server (StatsCollector), oldest first.
  // viewers + streams are real; health is not served yet (the row shows a placeholder).
  // Mock kept for offline dev. quiet: a pre-metrics-history server 404s here, non-fatal.
  metricsHistory: (name: string, signal?: AbortSignal) =>
    api.get<{ viewers?: number[]; streams?: number[] }>(
      `/applications/${id(name)}/metrics-history`, { signal, quiet: true },
    ),
}
