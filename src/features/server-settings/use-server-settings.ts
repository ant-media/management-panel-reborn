import { useApi } from '@/lib/api/use-api'
import { server } from '@/lib/api/endpoints'
import { errorMessage, type Result } from '@/lib/api'

// The full ServerSettings POJO. We only edit logLevel + licenceKey (all the POST
// actually persists), but hold the WHOLE object: see saveServerSettings.
export type ServerSettings = Record<string, unknown> & {
  serverName?: string
  licenceKey?: string
  logLevel?: string
  nodeGroup?: string
  sslEnabled?: boolean
  buildForMarket?: boolean
  hostAddress?: string
  defaultHttpPort?: number
}

export const LOG_LEVELS: [string, string][] = [
  ['INFO', 'INFO'], ['WARN', 'WARN'], ['ERROR', 'ERROR'], ['OFF', 'OFF'],
]

export function useServerSettings() {
  return useApi<ServerSettings>(signal => server.settings(signal))
}

// POST /server-settings persists ONLY serverName, licenceKey, nodeGroup, logLevel,
// and BLANKS serverName/licenceKey (and writes "null" to nodeGroup) when they're
// absent. So we always POST the whole fetched POJO with edits merged in, never a
// partial; otherwise a save wipes serverName/nodeGroup. Returns the Result envelope.
export async function saveServerSettings(settings: ServerSettings): Promise<Result> {
  try {
    const res = await server.saveSettings(settings)
    if (!res || res.success === false) console.warn('[ServerSettings] save rejected by server:', res)
    return res ?? { success: false, message: 'Empty response' }
  } catch (err) {
    return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
  }
}
