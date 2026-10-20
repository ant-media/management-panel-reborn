import { server } from '@/lib/api/endpoints'
import { ApiError, errorMessage, type Result } from '@/lib/api'

// SSL is write-only: POST /ssl-settings?domain=&type= (multipart). There is NO GET,
// so the panel can't read current cert state. `type` is valueOf()'d server-side, so
// it must be the exact enum name. Configuring SSL restarts the server.
export type SslType = 'CUSTOM_DOMAIN' | 'ANTMEDIA_SUBDOMAIN' | 'CUSTOM_CERTIFICATE'

export type CertFiles = { fullChain: File; privateKey: File; chain: File }

// Bare FQDN, like the legacy console checks. The server keeps only the first run its `extractFQDN`
// matches (`find()`, at most 11 labels, an ending of 2 to 6 letters), so a domain it can't read
// whole would silently request another one. Returns why the domain is rejected.
const FQDN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.){1,10}[A-Za-z]{2,}$/
export function checkDomain(d: string): string | undefined {
  if (!FQDN.test(d)) return 'Enter a bare domain like stream.example.com (no scheme, port or path).'
  const tld = d.slice(d.lastIndexOf('.') + 1)
  if (tld.length > 6) return `.${tld} isn’t supported: Ant Media only reads domain endings up to 6 letters.`
  return undefined
}

// `restarting`: no answer came back. enable_ssl.sh ends in `service antmedia restart` while the
// handler still waits on it, so a successful apply drops the connection (or a proxy 502-504s)
// instead of returning a Result.
export type SslResult = Result & { restarting?: boolean }

export async function configureSsl(type: SslType, domain: string, files?: CertFiles): Promise<SslResult> {
  try {
    const res = await server.configureSsl(type, domain, files)
    if (!res || res.success === false) console.warn('[SSL] configure rejected by server:', res)
    return res ?? { success: false, message: 'Empty response' }
  } catch (err) {
    if (!(err instanceof ApiError) || [502, 503, 504].includes(err.status)) return { success: false, restarting: true }
    return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
  }
}
