import { emitAuthFailure } from './auth-bridge'
import { ApiError, type HttpMethod, type Query, type RequestOptions, type Transport } from './transport'

export type MockContext = {
  method: HttpMethod
  path: string
  query: Query
  body: unknown
  params: Record<string, string>
}

export type MockHandler = (ctx: MockContext) => unknown | Promise<unknown>

type LiteralEntry = { kind: 'literal'; handler: MockHandler }
type PatternEntry = {
  kind: 'pattern'
  regex: RegExp
  paramNames: string[]
  handler: MockHandler
}

// Two maps keyed by `METHOD path`: literal first (O(1)), patterns second (linear, small).
const literals = new Map<string, LiteralEntry>()
const patterns = new Map<HttpMethod, PatternEntry[]>()

const keyOf = (method: string, path: string) => `${method.toUpperCase()} ${path}`

// Compile a path with `:name` placeholders into a regex + ordered param list.
// We escape regex metacharacters first, then re-substitute the `:name` slots.
function compilePattern(path: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = []
  // Escape regex meta first; ':' is not a meta char so the placeholders survive escaping.
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const source = escaped.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    paramNames.push(name)
    return '([^/]+)'
  })
  return { regex: new RegExp(`^${source}$`), paramNames }
}

export function registerMock(method: HttpMethod, path: string, handler: MockHandler) {
  if (path.includes(':')) {
    const { regex, paramNames } = compilePattern(path)
    const list = patterns.get(method) ?? []
    list.push({ kind: 'pattern', regex, paramNames, handler })
    patterns.set(method, list)
  } else {
    literals.set(keyOf(method, path), { kind: 'literal', handler })
  }
}

function resolve(method: HttpMethod, path: string): { handler: MockHandler; params: Record<string, string> } | null {
  const lit = literals.get(keyOf(method, path))
  if (lit) return { handler: lit.handler, params: {} }
  const list = patterns.get(method)
  if (!list) return null
  for (const entry of list) {
    const m = entry.regex.exec(path)
    if (!m) continue
    const params: Record<string, string> = {}
    entry.paramNames.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]) })
    return { handler: entry.handler, params }
  }
  return null
}

// Dev only: fake a backend outage (raw network throw) to exercise the reconnect UI without a
// server. Toggle from the console; wired onto window in main.tsx.
let mockOffline = false
export function setMockOffline(on: boolean) { mockOffline = on }

export class MockTransport implements Transport {
  private readonly latencyMs: number

  constructor(latencyMs: number = 120) {
    this.latencyMs = latencyMs
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    opts.signal?.throwIfAborted()

    await this.simulateLatency(opts.signal)

    if (mockOffline) throw new TypeError('Failed to fetch')

    const method = (opts.method ?? 'GET') as HttpMethod
    const match = resolve(method, path)
    if (!match) {
      throw new ApiError(404, `[mock] no handler for ${method} ${path}`)
    }

    const result = await match.handler({
      method,
      path,
      query: opts.query ?? {},
      body: opts.body,
      params: match.params,
    })

    if (result instanceof ApiError) {
      if (result.status === 401 || result.status === 403) emitAuthFailure()
      throw result
    }

    return result as T
  }

  private simulateLatency(signal?: AbortSignal): Promise<void> {
    const delay = this.latencyMs * (0.5 + Math.random())
    return new Promise((resolve, reject) => {
      const t = setTimeout(resolve, delay)
      signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(signal.reason ?? new DOMException('aborted', 'AbortError'))
      }, { once: true })
    })
  }
}
