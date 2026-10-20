import { resultMessage } from '@/lib/api'
import { ipcamera } from '@/lib/api/endpoints'
import type { Move } from '@/lib/api/endpoints/ipcamera'

// The bits of @antmedia/web_player that the legacy console sets for an `ipCamera`.
type WebPlayer = {
  isIPCamera: boolean
  restAPIPromise: ((endpoint: string) => Promise<unknown>) | null
  videojsPlayer?: { paused(): boolean }
  injectPtzElements?: () => void
}

const MOVE_FAILED = 'Camera didn’t move. Check that it’s online and supports PTZ.'

// Legacy parity: the console builds its WebPlayer with `isIPCamera` and a `restAPIPromise` that
// tunnels through the backend proxy, so the player draws its own PTZ overlay. play.html exposes
// the same player as `window.webPlayer`, so set the same two fields on it. The move goes out with
// our stream id, not the player's (which carries the subFolder prefix and would 404).
// `onMove` gets the failure to show, or null once a move goes through.
export function enablePtz(win: Window, appName: string, streamId: string, onMove: (error: string | null) => void) {
  const player = (win as Window & { webPlayer?: WebPlayer }).webPlayer
  if (!player?.injectPtzElements) return
  const cam = ipcamera(appName)
  player.restAPIPromise = endpoint => {
    const url = new URL(endpoint, win.location.href)
    if (!url.pathname.endsWith('/ip-camera/move')) return Promise.reject(new Error(`Unsupported player call: ${endpoint}`))
    const q = url.searchParams
    return cam.move(streamId, {
      valueX: Number(q.get('valueX')),
      valueY: Number(q.get('valueY')),
      valueZ: Number(q.get('valueZ')),
      movement: (q.get('movement') ?? undefined) as Move['movement'],
    }).then(res => {
      if (res?.success === false) {
        const why = resultMessage(res)
        onMove(why ? `Camera didn’t move: ${why}` : MOVE_FAILED)
      } else onMove(null)
      return res
    }, err => {
      onMove(MOVE_FAILED)
      throw err
    })
  }
  player.isIPCamera = true
  // The player injects on its `play` event; if that already fired, inject now (it is idempotent).
  if (player.videojsPlayer && !player.videojsPlayer.paused()) player.injectPtzElements()
}
