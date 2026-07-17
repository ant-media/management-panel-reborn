import { broadcasts } from '@/lib/api/endpoints'
import type { AppSettings } from '@/features/apps/use-app-settings'

// Playback-gating helpers shared by the live-stream and VoD embedded players.

// A play token is minted per playback and only needs to survive until the first frame.
const TOKEN_TTL_SEC = 100

// TOTP tokens are time-based secrets derived from a server-side key the panel doesn't hold,
// so a TOTP-gated app can only be played from a client that can compute them.
export const TOTP_UNSUPPORTED =
  'This app gates playback with TOTP tokens, which the panel cannot generate. Play it from a client that can.'

// The playback-gating flags an app can set. `gated` means a token is required; `jwt` picks
// the JWT flavour over a plain one-time token.
export function playGating(settings: AppSettings | null) {
  const jwt = settings?.playJwtControlEnabled === true
  return {
    totp: settings?.enableTimeTokenForPlay === true,
    jwt,
    gated: jwt || settings?.playTokenControlEnabled === true,
  }
}

// Mints a short-lived play token bound to the raw stream/vod id (legacy console parity).
export async function mintPlayToken(appName: string, id: string, jwt: boolean): Promise<string | undefined> {
  const expireDate = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC
  const api = broadcasts(appName)
  const res = await (jwt
    ? api.getJwtToken(id, expireDate, 'play')
    : api.getToken(id, expireDate, 'play')) as { tokenId?: string }
  return res?.tokenId
}
