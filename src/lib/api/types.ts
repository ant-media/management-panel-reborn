import type { Query } from './transport'

// REST envelope the AMS backend reuses across resources. `dataId` is the wire
// field the backend fills with a record id (e.g. the created stream id in a
// bulk-create result); `id` is the frontend-normalised alias set by callers.
export type Result = { success: boolean; message?: string; id?: string; dataId?: string }

// A failed Result is NOT guaranteed to say why: starting a playlist whose source file will not
// open answers `{"success":false,"message":""}`. Read a failure through these two and never off
// `res.message` directly, or the empty string rides through `??` and the user gets a blank red
// banner. `||` would also work, but the rule lives here so no call site has to remember it.
export function resultMessage(res: Result): string | undefined {
  return res.message?.trim() || undefined
}

export function resultError(res: Result, fallback: string): string {
  return resultMessage(res) ?? fallback
}

// Same hole on the thrown-error path: an ApiError built from an empty body and an empty
// statusText (HTTP/2 sends none), or a `new Error('')`, carries a blank message.
export function errorMessage(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message.trim() : typeof e === 'string' ? e.trim() : ''
  return msg || fallback
}

// Paged-collection list opts (broadcasts, vods). Lives here because the snake_case
// wire mapping must stay identical across every paged endpoint.
export type ListOpts = { search?: string; sortBy?: string; order?: 'asc' | 'desc'; type?: string }

export function listQuery(o: ListOpts): Query {
  const q: Query = {}
  if (o.sortBy) { q.sort_by = o.sortBy; q.order_by = o.order ?? 'asc' }
  if (o.search?.trim()) q.search = o.search.trim()
  if (o.type) q.type_by = o.type // broadcasts only
  return q
}
