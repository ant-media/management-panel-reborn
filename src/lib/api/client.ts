import { storage } from '@/lib/localStorage'
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

// Per-app REST at `/{appName}/rest/v2/...`, tunneled through the backend proxy (transport.ts), which
// signs the app JWT server-side. A pasted `{app}jwtToken` is still sent: JWKS apps need it, the proxy
// can't sign for them. A 403 is kept out of the global logout.
export function appApi(appName: string) {
  const base = build(`/${encodeURIComponent(appName)}/rest/v2`)

  type Opts = { query?: Query; signal?: AbortSignal }
  const opts = (o: Opts): CallOpts => {
    const auth = storage.get(`${appName}jwtToken`)
    return { ...o, headers: auth ? { Authorization: auth } : undefined, suppressAuthEmit: true, pushToBackendProxy: true }
  }
  return {
    get:    <T>(path: string, o: Opts = {})                  => base.get<T>(path,        opts(o)),
    post:   <T>(path: string, body?: unknown, o: Opts = {})  => base.post<T>(path, body, opts(o)),
    put:    <T>(path: string, body?: unknown, o: Opts = {})  => base.put<T>(path, body,  opts(o)),
    delete: <T>(path: string, o: Opts & { body?: unknown } = {}) => base.delete<T>(path, opts(o)),
  }
}
