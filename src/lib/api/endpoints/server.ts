import { api } from '../client'
import type { Result } from '../types'
import type { ServerSettings } from '@/features/server-settings/use-server-settings'
import type { SslType, CertFiles } from '@/features/server-settings/use-ssl'

export const server = {
  settings: (signal?: AbortSignal) => api.get<ServerSettings>('/server-settings', { signal }),
  saveSettings: (s: ServerSettings) => api.post<Result>('/server-settings', s),
  // licence-status can come back empty; system-resources.license / last-licence-status carry it.
  licenceStatus: (signal?: AbortSignal) => api.get<unknown>('/licence-status', { signal }),
  lastLicenceStatus: (signal?: AbortSignal) => api.get<unknown>('/last-licence-status', { signal }),
  enterpriseEdition: (signal?: AbortSignal) => api.get<Result>('/enterprise-edition', { signal }),

  // Write-only multipart; restarts the server. `type` must be the exact enum name.
  configureSsl: (type: SslType, domain: string, files?: CertFiles) => {
    const form = new FormData()
    if (type === 'CUSTOM_CERTIFICATE' && files) {
      form.append('fullChainFile', files.fullChain)
      form.append('privateKeyFile', files.privateKey)
      form.append('chainFile', files.chain)
    }
    return api.post<Result>('/ssl-settings', form, { query: { domain, type } })
  },
}
