// URL formulae for streams. Everything hangs off `mediaOrigin`, so the UI generates
// copy-paste-ready URLs without knowing the server's public hostname, and the player
// iframe loads in dev too.

import { mediaOrigin } from '@/lib/media-origin'

export function rtmpIngestUrl(appName: string, streamId: string): string {
  const { hostname } = new URL(mediaOrigin())
  return `rtmp://${hostname}/${encodeURIComponent(appName)}/${encodeURIComponent(streamId)}`
}

export function previewUrl(appName: string, streamId: string): string {
  return `${mediaOrigin()}/${encodeURIComponent(appName)}/previews/${encodeURIComponent(streamId)}.png`
}

// AMS's bundled player page. `playOrder` is a comma-separated protocol preference
// (webrtc, hls, dash, vod, ll-hls); `token` is required when the app gates playback.
export function playPageUrl(
  appName: string,
  streamId: string,
  opts: { playOrder?: string; token?: string } = {},
): string {
  const q = new URLSearchParams({ id: streamId })
  if (opts.playOrder) q.set('playOrder', opts.playOrder)
  if (opts.token) q.set('token', opts.token)
  return `${mediaOrigin()}/${encodeURIComponent(appName)}/play.html?${q}`
}

export function embedSnippet(appName: string, streamId: string): string {
  const src = playPageUrl(appName, streamId)
  return `<iframe src="${src}" allowfullscreen allow="autoplay; fullscreen" width="640" height="360" frameborder="0"></iframe>`
}
