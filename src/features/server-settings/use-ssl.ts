import { server } from '@/lib/api/endpoints'
import { errorMessage, type Result } from '@/lib/api'

// SSL is write-only: POST /ssl-settings?domain=&type= (multipart). There is NO GET,
// so the panel can't read current cert state. `type` is valueOf()'d server-side, so
// it must be the exact enum name. Configuring SSL restarts the server.
export type SslType = 'CUSTOM_DOMAIN' | 'ANTMEDIA_SUBDOMAIN' | 'CUSTOM_CERTIFICATE'

export type CertFiles = { fullChain: File; privateKey: File; chain: File }

export async function configureSsl(type: SslType, domain: string, files?: CertFiles): Promise<Result> {
  try {
    const res = await server.configureSsl(type, domain, files)
    if (!res || res.success === false) console.warn('[SSL] configure rejected by server:', res)
    return res ?? { success: false, message: 'Empty response' }
  } catch (err) {
    return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
  }
}
