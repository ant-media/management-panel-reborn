// Origin that serves media: previews, play.html, VoD files. In prod the panel ships inside
// the server, so it's our own origin. In dev vite proxies only /rest/v2, so anything the
// browser has to actually *load* must point at the backend itself.
export function mediaOrigin(): string {
  if (import.meta.env.DEV) return import.meta.env.VITE_BACKEND || 'http://localhost:5080'
  return window.location.origin
}
