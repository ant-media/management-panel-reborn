// VoD files are served by the app at `/{appName}/{filePath}`, off `mediaOrigin`.

import { broadcasts } from '@/lib/api/endpoints'
import { mediaOrigin } from '@/lib/media-origin'
import type { VoD } from './types'

// `filePath` is a server path ("streams/<id>.mp4") whose slashes are significant,
// so only the app segment is encoded. Returns null when the file isn't known yet.
export function vodFileUrl(appName: string, filePath: string | undefined): string | null {
  if (!filePath) return null
  return `${mediaOrigin()}/${encodeURIComponent(appName)}/${filePath.replace(/^\/+/, '')}`
}

// Unlike the web-relative `filePath`, `previewFilePath` arrives as an absolute
// server path (…/webapps/{app}/previews/x.png; captured live, see API.md appendix).
// Serve the part under the app web root; anything outside it isn't reachable.
export function vodPreviewUrl(appName: string, previewFilePath: string | undefined | null): string | null {
  if (!previewFilePath) return null
  const marker = `/webapps/${appName}/`
  const i = previewFilePath.indexOf(marker)
  const rel = i >= 0 ? previewFilePath.slice(i + marker.length) : previewFilePath
  return rel.startsWith('/') ? null : vodFileUrl(appName, rel)
}

// Far-future expiry (year 2271), the same value the legacy console used.
export const INFINITE_JWT_EXPIRE_DATE = 9516239022

// Playlist-item URL for a server-hosted VoD. When the app enforces play JWTs a bare
// file URL won't play, so mint one and ride it on the query string (legacy console
// parity; a short-lived token minted at play time, or server-side resolution, would
// be better long term). Degrades to the bare URL if the mint fails: the item is
// still editable, and the create itself must not be blocked by a token hiccup.
export async function vodPlaylistUrl(appName: string, vod: VoD, playJwt: boolean): Promise<string | null> {
  const url = vodFileUrl(appName, vod.filePath)
  if (!url || !playJwt) return url
  try {
    const tok = await broadcasts(appName).getJwtToken(vod.vodId, INFINITE_JWT_EXPIRE_DATE, 'play') as { tokenId?: string }
    return tok?.tokenId ? `${url}?token=${tok.tokenId}` : url
  } catch {
    return url
  }
}
