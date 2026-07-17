import { emitAuthFailure } from './auth-bridge'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue>

export type RequestOptions = {
  method?: HttpMethod
  body?: unknown
  query?: Query
  signal?: AbortSignal
  headers?: Record<string, string>
  // App calls set this: a 403 there means "JWT required", not "session dead", so it must
  // not trip the global auth-failure → logout. The caller mints a token and retries instead.
  suppressAuthEmit?: boolean
  // Mock-only endpoints (TODO: BACKEND) set this so their expected 404s against a real
  // backend don't spam the debug logger. The error still throws; it's just not logged.
  quiet?: boolean
  // Per-app call: FetchTransport tunnels it through the backend proxy; MockTransport ignores it.
  pushToBackendProxy?: boolean
}

export interface Transport {
  request<T>(path: string, options?: RequestOptions): Promise<T>
}

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export function buildUrl(base: string, path: string, query?: Query): string {
  const trimmedBase = base.replace(/\/$/, '')
  const sep = path.startsWith('/') ? '' : '/'
  let url = `${trimmedBase}${sep}${path}`
  if (!query) return url

  const parts: string[] = []
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  if (parts.length === 0) return url

  url += url.includes('?') ? '&' : '?'
  return url + parts.join('&')
}

export class FetchTransport implements Transport {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    // Apps IP-filter their REST to `remoteAllowedCIDR` (default 127.0.0.1), so only the server
    // may call them; root's ProxyServlet re-issues from localhost. `_path` is encoded over the
    // segment encoding `endpoints/` already applied; the servlet decodes it exactly once.
    const target = options.pushToBackendProxy
      ? `/rest/v2/request?_path=${encodeURIComponent(path.replace(/^\//, ''))}`
      : path
    const url = buildUrl(this.baseUrl, target, options.query)
    const hasBody = options.body !== undefined
    // FormData (file uploads) must travel as multipart; let the browser set
    // Content-Type so it can attach the boundary marker. JSON is the default.
    const isMultipart = options.body instanceof FormData

    const headers: Record<string, string> = { ...(options.headers ?? {}) }
    if (hasBody && !isMultipart) headers['Content-Type'] = 'application/json'

    const res = await fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: Object.keys(headers).length ? headers : undefined,
      body: hasBody ? (isMultipart ? (options.body as FormData) : JSON.stringify(options.body)) : undefined,
      signal: options.signal,
    })

    if (res.status === 401 || res.status === 403) {
      if (!options.suppressAuthEmit) emitAuthFailure()
      throw new ApiError(res.status, res.statusText || 'Unauthorized')
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // statusText is always empty over HTTP/2, so a failure with an empty body would otherwise
      // throw an Error carrying no message at all.
      throw new ApiError(res.status, body || res.statusText || `Request failed (HTTP ${res.status})`, body)
    }

    const text = await res.text()
    if (!text) return undefined as T

    // Sniff content-type instead of always trying JSON: text endpoints (e.g. /log-file)
    // legitimately return non-JSON, and a 200 that claims JSON but doesn't parse is a real bug.
    const isJson = (res.headers.get('content-type') ?? '').includes('json')
    if (!isJson) return text as unknown as T

    try {
      return JSON.parse(text) as T
    } catch (e) {
      throw new ApiError(res.status, `invalid JSON: ${(e as Error).message}`, text)
    }
  }
}
