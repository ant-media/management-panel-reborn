import { storage } from '@/lib/localStorage'

// App-scoped JWT. When an app has JWT control on and the admin hasn't pasted a token,
// the panel mints one itself: read the app's jwtSecretKey (admin-readable via management
// settings) and sign a short-lived HS256 token. AMS's JWTFilter validates signature + exp
// only (no required claims); verified against a live server. Done lazily on a 403 so open
// apps pay nothing. The clean long-term replacement (secret never leaves the server) is a
// backend mint endpoint; tracked in docs/dev-progress/TODO.md (V2).

const TTL_MS = 5 * 60_000
const MARGIN_MS = 30_000

type Minted = { token: string; expMs: number }
const minted = new Map<string, Minted>()
// One mint in flight per app, so concurrent 403s share a single secret read.
const minting = new Map<string, Promise<string | null>>()

const te = new TextEncoder()

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const byte of b) s += String.fromCharCode(byte)
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

const segment = (obj: unknown) => b64url(te.encode(JSON.stringify(obj)))

async function mintHs256(secret: string, expSec: number): Promise<string> {
  const data = `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment({ exp: expSec })}`
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(data))
  return `${data}.${b64url(sig)}`
}

// Best Authorization for an app call right now, no network. Pasted token wins; else a
// still-valid minted token; else null (send nothing: open app, or mint on the 403).
export function appAuthorization(app: string): string | null {
  const pasted = storage.get(`${app}jwtToken`)
  if (pasted) return pasted
  const m = minted.get(app)
  return m && m.expMs - Date.now() > MARGIN_MS ? m.token : null
}

// Called after a 403: the token to retry with, one we already hold, or a fresh mint. Handing
// back the token the caller just sent means "don't retry" (a pasted token was rejected, or the
// 403 was never about JWT). Never rejects, so the caller's 403 always survives.
export function ensureAppToken(app: string, readSecret: () => Promise<string>): Promise<string | null> {
  const held = appAuthorization(app)
  if (held) return Promise.resolve(held)

  let pending = minting.get(app)
  if (!pending) {
    pending = mint(app, readSecret).finally(() => minting.delete(app))
    minting.set(app, pending)
  }
  return pending
}

// null whenever nothing is mintable: no secret (a jwksURL/RS256 app, or the misconfig in
// RISKS.md), a dead session, or an insecure origin: `crypto.subtle` exists only under HTTPS
// (and on localhost), so a plain-HTTP panel can reach a JWT app only with a pasted token.
async function mint(app: string, readSecret: () => Promise<string>): Promise<string | null> {
  if (!crypto.subtle) return null
  try {
    const secret = await readSecret()
    if (!secret) return null
    const expMs = Date.now() + TTL_MS
    const token = await mintHs256(secret, Math.floor(expMs / 1000))
    minted.set(app, { token, expMs })
    return token
  } catch { return null }
}
