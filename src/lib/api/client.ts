import { appAuthorization, ensureAppToken } from './app-jwt'
import { emitReachability } from './connection-bridge'
import { MockTransport } from './mock'
import { ApiError, FetchTransport, type Query, type RequestOptions, type Transport } from './transport'

const MGMT_PREFIX = '/rest/v2'

// Mocks are opt-in via `VITE_USE_MOCKS=true` (e.g. in `.env.local`).
// Default OFF: production hits the real backend; dev needs a backend OR this flag.
export const MOCKS_ENABLED = import.meta.env.VITE_USE_MOCKS === 'true'

// Transports treat paths as opaque; the prefix is baked in below at call sites,
// so MockTransport pattern-matches the same full path FetchTransport would hit.
const baseTransport: Transport = MOCKS_ENABLED
  ? new MockTransport()
  : new FetchTransport('')

// Single chokepoint over both transports. Two side effects, never alters the result: tee the
// real error to the console (skipping aborts + `quiet` mock-only 404s), and report reachability
// (a response, even an ApiError, means reachable; a raw network throw means not).
const transport: Transport = {
  request: async <T>(path: string, opts?: RequestOptions): Promise<T> => {
    try {
      const res = await baseTransport.request<T>(path, opts)
      emitReachability(true)
      return res
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      if (!isAbort) emitReachability(err instanceof ApiError)
      if (!isAbort && !opts?.quiet) {
        console.error(`[api] ${opts?.method ?? 'GET'} ${path} failed:`, err)
      }
      throw err
    }
  },
}

type CallOpts = Omit<RequestOptions, 'method' | 'body'>

function build(prefix: string) {
  const at = (path: string) => `${prefix}${path}`
  return {
    get:    <T>(path: string, opts: CallOpts = {})                       => transport.request<T>(at(path), { method: 'GET',    ...opts }),
    post:   <T>(path: string, body?: unknown, opts: CallOpts = {})       => transport.request<T>(at(path), { method: 'POST',   body, ...opts }),
    put:    <T>(path: string, body?: unknown, opts: CallOpts = {})       => transport.request<T>(at(path), { method: 'PUT',    body, ...opts }),
    delete: <T>(path: string, opts: CallOpts & { body?: unknown } = {})  => transport.request<T>(at(path), { method: 'DELETE', ...opts }),
  }
}

export const api = build(MGMT_PREFIX)

// Per-app REST at `/{appName}/rest/v2/...`, tunneled through the backend proxy (transport.ts).
// Auth: a pasted `{app}jwtToken`, else one minted from the app secret (app-jwt.ts), sent when
// present, ignored by apps without JWT control. A 403 is kept out of the global logout, then a
// token is obtained and the call retried once.
export function appApi(appName: string) {
  const encoded = encodeURIComponent(appName)
  const base = build(`/${encoded}/rest/v2`)
  const readSecret = () =>
    api.get<{ jwtSecretKey?: string }>(`/applications/settings/${encoded}`).then(s => s.jwtSecretKey ?? '')

  const hdr = (auth: string | null) => (auth ? { Authorization: auth } : undefined)

  function withJwt<T>(run: (auth: string | null) => Promise<T>): Promise<T> {
    const auth = appAuthorization(appName)
    return run(auth).catch(async err => {
      if (err instanceof ApiError && err.status === 403) {
        const token = await ensureAppToken(appName, readSecret)
        // Unchanged token ⇒ the 403 is real (or the session died); a retry just repeats it.
        if (token && token !== auth) return run(token)
      }
      throw err
    })
  }

  type Opts = { query?: Query; signal?: AbortSignal }
  const opts = (o: Opts, auth: string | null): CallOpts =>
    ({ ...o, headers: hdr(auth), suppressAuthEmit: true, pushToBackendProxy: true })
  return {
    get:    <T>(path: string, o: Opts = {})                  => withJwt(a => base.get<T>(path,        opts(o, a))),
    post:   <T>(path: string, body?: unknown, o: Opts = {})  => withJwt(a => base.post<T>(path, body, opts(o, a))),
    put:    <T>(path: string, body?: unknown, o: Opts = {})  => withJwt(a => base.put<T>(path, body,  opts(o, a))),
    delete: <T>(path: string, o: Opts & { body?: unknown } = {}) => withJwt(a => base.delete<T>(path, opts(o, a))),
  }
}
