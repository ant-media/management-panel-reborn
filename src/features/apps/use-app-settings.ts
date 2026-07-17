import { useApi } from '@/lib/api/use-api'
import { apps } from '@/lib/api/endpoints'
import { errorMessage, type Result } from '@/lib/api'

// AppSettings is a sprawling Java POJO (hundreds of fields). We only render a
// curated subset (see settings-schema.ts); the rest still rides along on save:
// the editor POSTs the WHOLE object back so untouched fields are never wiped.
export type AppSettings = Record<string, unknown> & {
  appName?: string
}

export function useAppSettings(appName: string | undefined) {
  return useApi<AppSettings>(
    signal => apps.getSettings(appName ?? '', signal),
    { enabled: Boolean(appName), refetchKey: appName },
  )
}

// Whether the app enforces play JWTs (a picked VoD URL then needs a ?token=).
// Pessimistic: false until the flag is known true, so we never mint needlessly.
export function usePlayJwtEnabled(appName: string | undefined, enabled = true): boolean {
  const { data } = useApi<AppSettings>(
    signal => apps.getSettings(appName ?? '', signal),
    { enabled: enabled && Boolean(appName), refetchKey: appName },
  )
  return data?.playJwtControlEnabled === true
}

// True unless the app has writeStatsToDatastore off (then viewer counts read 0). Console
// scope, no app JWT. Optimistic: true until the flag is known, so the UI never flickers "off".
export function useViewerStatsEnabled(appName: string | undefined, enabled = true): boolean {
  const { data } = useApi<AppSettings>(
    signal => apps.getSettings(appName ?? '', signal),
    { enabled: enabled && Boolean(appName), refetchKey: appName },
  )
  return data?.writeStatsToDatastore !== false
}

export async function saveAppSettings(appName: string, settings: AppSettings): Promise<Result> {
  try {
    const res = await apps.saveSettings(appName, settings)
    // App-level reject (HTTP 200, success:false) isn't a thrown error, so the transport
    // logger won't see it; surface the raw server reply here for debugging.
    if (!res || res.success === false) console.warn('[AppSettings] save rejected by server:', res)
    return res ?? { success: false, message: 'Empty response' }
  } catch (err) {
    return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
  }
}
