import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useApi } from '@/lib/api/use-api'
import { server, type Licence } from '@/lib/api/endpoints'
import type { PillTone } from '@/components/shared/pill'

// Reads the backend's cache, which its own check rewrites every 5 minutes.
const LICENCE_POLL_MS = 60_000

// `Licence.status` verbatim from Enterprise `LicenceService`; `expiring` / `invalid` / `expired`
// come from a local licence server. Only `err` raises the global warning: `serverRequestError`
// means the check could not run, which is not a bad licence.
const STATUSES: Record<string, { tone: PillTone; label: string }> = {
  valid:                 { tone: 'ok',   label: 'active' },
  expiring:              { tone: 'warn', label: 'expiring soon' },
  serverRequestError:    { tone: 'warn', label: 'check failed' },
  expired:               { tone: 'err',  label: 'expired' },
  invalid:               { tone: 'err',  label: 'invalid' },
  LICENSE_EXPIRED:       { tone: 'err',  label: 'expired' },
  LICENSE_BLOCKED:       { tone: 'err',  label: 'suspended' },
  INVALID_KEY:           { tone: 'err',  label: 'invalid key' },
  NO_LICENSE_FOUND:      { tone: 'err',  label: 'no license found' },
  NO_LICENSE_DEFINED:    { tone: 'err',  label: 'no license defined' },
  ALL_LICENSES_ARE_USED: { tone: 'err',  label: 'seat limit reached' },
  TRIAL_PERIOD_ENDED:    { tone: 'err',  label: 'trial ended' },
}

export type LicenceState = { tone: PillTone; label: string; broken: boolean }

// null = nothing to report: Community (null body) or no verdict yet (blank status, e.g. a
// marketplace build). An unknown code shows verbatim so it can be looked up.
function licenceState(licence: Licence | null): LicenceState | null {
  const status = licence?.status
  if (!status) return null
  const hit = STATUSES[status] ?? { tone: 'err' as const, label: status }
  return { ...hit, broken: hit.tone === 'err' }
}

type Context = {
  licence: Licence | null
  state: LicenceState | null
  // Forces a server-side check. `POST /server-settings` does not, so a saved key reads stale without it.
  recheck: (key: string) => Promise<void>
  // The warning dialog re-raises on a page change once a minute has passed since this.
  warningDismissedAt: number | null
  dismissWarning: () => void
}

const LicenceContext = createContext<Context | null>(null)

export function LicenceProvider({ children }: { children: ReactNode }) {
  const { data: licence, refresh } = useApi<Licence | null>(
    signal => server.lastLicenceStatus(signal),
    { pollMs: LICENCE_POLL_MS },
  )
  const [warningDismissedAt, setWarningDismissedAt] = useState<number | null>(null)

  const recheck = useCallback(async (key: string) => {
    // A blank key is not a no-op server-side: it would be checked, fail, and cached as INVALID_KEY.
    if (!key) return
    // Best-effort; the re-read returns the cache either way, and keeps `useApi` the one owner.
    await server.licenceStatus(key).catch(() => {})
    refresh()
  }, [refresh])

  const value = useMemo<Context>(() => ({
    licence,
    state: licenceState(licence),
    recheck,
    warningDismissedAt,
    dismissWarning: () => setWarningDismissedAt(Date.now()),
  }), [licence, recheck, warningDismissedAt])

  return <LicenceContext.Provider value={value}>{children}</LicenceContext.Provider>
}

export function useLicence(): Context {
  const ctx = useContext(LicenceContext)
  if (!ctx) throw new Error('useLicence must be used inside <LicenceProvider>')
  return ctx
}
