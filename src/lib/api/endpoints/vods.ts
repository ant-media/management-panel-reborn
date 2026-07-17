import { appApi } from '../client'
import { listQuery, type ListOpts, type Result } from '../types'
import type { VoD } from '@/features/vods/types'

// Per-app VoD surface (`@Path /v2/vods`). Factory bound to one app.
export function vods(app: string) {
  const c = appApi(app)
  const id = (v: string) => encodeURIComponent(v)

  return {
    // `streamId` (exact match, vods-only) stays out of the shared ListOpts on purpose.
    list: (offset: number, size: number, opts: ListOpts & { streamId?: string } = {}, signal?: AbortSignal) =>
      c.get<VoD[]>(`/vods/list/${offset}/${size}`, {
        query: { ...listQuery(opts), ...(opts.streamId ? { streamId: opts.streamId } : null) },
        signal,
      }),
    get: (vodId: string, signal?: AbortSignal) =>
      c.get<VoD>(`/vods/${id(vodId)}`, { signal }),
    // Search rides as a path segment here (unlike list); no streamId variant exists.
    count: (search?: string, signal?: AbortSignal) => {
      const s = search?.trim()
      const path = s ? `/vods/count/${id(s)}` : '/vods/count'
      return c.get<{ number: number }>(path, { signal }).then(r => r.number)
    },
    remove: (vodId: string) => c.delete<Result>(`/vods/${id(vodId)}`),
    // Bulk delete: comma-separated ids as a query param on the collection path.
    removeMany: (ids: string[]) =>
      c.delete<Result>('/vods/', { query: { ids: ids.join(',') } }),
    // Multipart upload: filename rides as a query param, bytes as the `file` part.
    upload: (file: File, name?: string) => {
      const form = new FormData()
      form.append('file', file)
      return c.post<Result>('/vods/create', form, { query: { name: name?.trim() || file.name } })
    },
    // Register VoD files already present in a server-side directory.
    importDirectory: (directory: string) =>
      c.post<Result>('/vods/directory', undefined, { query: { directory } }),
    removeDirectory: (directory: string) =>
      c.delete<Result>('/vods/directory', { query: { directory } }),
  }
}
