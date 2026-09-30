import { useEffect, useState } from 'react'
import { errorMessage } from '@/lib/api'
import { useEnterprise } from '@/contexts/edition-context'
import type { AppSettings } from '@/features/apps/use-app-settings'
import { mintPlayToken, playGating, TOTP_UNSUPPORTED } from './play-token'
import { playPageUrl } from './url-builder'
import type { Broadcast } from './types'

const PLAY_ORDER = 'webrtc,hls,dash'

type PlayUrl = { url: string | null; error: string | null; loading: boolean }

// Resolves the bundled player's URL for a broadcast: protocol order, the app's stream
// namespace, and a play token when the app gates playback.
export function usePlayUrl(appName: string, { streamId, type }: Broadcast, settings: AppSettings | null): PlayUrl {
  const [state, setState] = useState<PlayUrl>({ url: null, error: null, loading: true })

  const { totp, jwt, gated } = playGating(settings)
  const subFolder = String(settings?.subFolder ?? '').trim()
  // Playlists only serve HLS. Community answers WebRTC play with "not found" and has no DASH.
  const hlsOnly = useEnterprise() === false || type === 'playlist'

  useEffect(() => {
    if (totp) return

    let cancelled = false
    void (async () => {
      try {
        // Mint failure falls back to a bare URL; the player surfaces the auth error itself.
        const token = gated ? await mintPlayToken(appName, streamId, jwt).catch(() => undefined) : undefined
        // subFolder apps namespace their live streams; ids that are already file paths don't.
        const id = subFolder && !streamId.includes('.') ? `${subFolder}/${streamId}` : streamId
        const playOrder = hlsOnly ? 'hls' : PLAY_ORDER
        if (!cancelled) setState({ url: playPageUrl(appName, id, { playOrder, token }), error: null, loading: false })
      } catch (e) {
        if (!cancelled) setState({ url: null, loading: false, error: errorMessage(e, 'Could not build the player URL for this stream.') })
      }
    })()
    return () => { cancelled = true }
  }, [appName, streamId, hlsOnly, subFolder, gated, jwt, totp])

  return totp ? { url: null, loading: false, error: TOTP_UNSUPPORTED } : state
}
