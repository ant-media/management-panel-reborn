import { api } from '../client'
import type { Result } from '../types'
import type { ServerSettings } from '@/features/server-settings/use-server-settings'
import type { SslType, CertFiles } from '@/features/server-settings/use-ssl'

// Community returns null (no licence service). `status` is a fixed backend vocabulary, mapped in
// features/server-settings/use-licence.
export type Licence = {
  licenceId?: string | null
  startDate?: string | null
  endDate?: string | null
  type?: string | null
  licenceCount?: string | null
  owner?: string | null
  status?: string | null
  hourUsed?: string | null
}

export const server = {
  settings: (signal?: AbortSignal) => api.get<ServerSettings>('/server-settings', { signal }),
  saveSettings: (s: ServerSettings) => api.post<Result>('/server-settings', s),
  // `licenceStatus` forces a fresh check and overwrites the server's cached licence, so `key` must be
  // non-blank and trimmed (a rejected key becomes the new status). `lastLicenceStatus` reads the cache.
  licenceStatus: (key: string, signal?: AbortSignal) =>
    api.get<Licence | null>('/licence-status', { query: { key }, signal }),
  lastLicenceStatus: (signal?: AbortSignal) => api.get<Licence | null>('/last-licence-status', { signal }),
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
