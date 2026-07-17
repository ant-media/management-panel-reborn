import { useEffect, useState } from 'react'
import { errorMessage } from '@/lib/api'
import type { AppSettings } from '@/features/apps/use-app-settings'
import { mintPlayToken, playGating, TOTP_UNSUPPORTED } from '@/features/streams/play-token'
import { playPageUrl } from '@/features/streams/url-builder'
import type { VoD } from './types'

type PlayUrl = { url: string | null; error: string | null; loading: boolean }

// Resolves the bundled player's URL for a VoD. The file is served as streams/<vodId>.<ext>,
// so the token is minted for the vodId and the player detects VoD from the streams/ prefix
// in the id.
export function useVodPlayUrl(appName: string, vod: VoD, settings: AppSettings | null): PlayUrl {
  const [state, setState] = useState<PlayUrl>({ url: null, error: null, loading: true })

  const { totp, jwt, gated } = playGating(settings)
  const { vodId, filePath } = vod

  useEffect(() => {
    if (totp || !filePath) return

    let cancelled = false
    void (async () => {
      try {
        // Mint failure falls back to a bare URL; the player surfaces the auth error itself.
        const token = gated ? await mintPlayToken(appName, vodId, jwt).catch(() => undefined) : undefined
        const id = filePath.replace(/^\/+/, '') // player keys VoD off the leading streams/ segment
        if (!cancelled) setState({ url: playPageUrl(appName, id, { token }), error: null, loading: false })
      } catch (e) {
        if (!cancelled) setState({ url: null, loading: false, error: errorMessage(e, 'Could not build the player URL for this VoD.') })
      }
    })()
    return () => { cancelled = true }
  }, [appName, vodId, filePath, gated, jwt, totp])

  if (totp) return { url: null, loading: false, error: TOTP_UNSUPPORTED }
  if (!filePath) return { url: null, loading: false, error: 'This VoD has no file to play yet.' }
  return state
}
