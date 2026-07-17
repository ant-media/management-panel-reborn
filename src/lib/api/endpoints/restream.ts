import { appApi } from '../client'
import type { Result } from '../types'

// Re-streaming targets (RTMP/SRT push) under `/v2/broadcasts/{id}/endpoint`.
// `type` is always "generic" for custom URLs; social endpoints (youtube/facebook)
// are enterprise/OAuth and not exposed here. Endpoints forward the source
// resolution only; the backend's optional `resolutionHeight` is intentionally
// not surfaced. `addEndpoint` returns `Result.dataId` = the server endpointServiceId.
export function restream(app: string) {
  const c = appApi(app)
  const id = (v: string) => encodeURIComponent(v)
  return {
    addEndpoint: (streamId: string, endpointUrl: string) =>
      c.post<Result>(`/broadcasts/${id(streamId)}/endpoint`, { endpointUrl, type: 'generic' }),
    removeEndpoint: (streamId: string, endpointServiceId: string) =>
      c.delete<Result>(`/broadcasts/${id(streamId)}/endpoint`, { query: { endpointServiceId } }),
  }
}
