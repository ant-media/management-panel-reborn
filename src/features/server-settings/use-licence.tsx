import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useApi } from '@/lib/api/use-api'
import { server, type Licence } from '@/lib/api/endpoints'
import type { PillTone } from '@/components/shared/pill'

// Reads a cached field server-side, so this is cheap; the backend re-checks with the licence
// server on its own 5-minute cycle, and nothing here would see a change sooner.
const LICENCE_POLL_MS = 15_000

// `Licence.status` verbatim from the backend (Ant-Media-Enterprise `LicenceService`). There is no
// "OK" or "Valid": `valid` is the only healthy value the cloud path emits, and a local licence
// server adds `expiring` (still in force, near its end date) plus its own `invalid` / `expired`.
// Everything here is a failure unless flagged, so an unrecognised code is treated as one too.
// `unverified` means the server could not complete a check, which must never raise the warning.
const STATUSES: Record<string, { tone: PillTone; label: string; live?: true; unverified?: true }> = {
  valid:                 { tone: 'ok',   label: 'active',                     live: true },
  expiring:              { tone: 'warn', label: 'expiring soon',              live: true },
  serverRequestError:    { tone: 'warn', label: 'licence server unreachable', unverified: true },
  expired:               { tone: 'err',  label: 'expired' },
  invalid:               { tone: 'err',  label: 'invalid' },
  LICENSE_EXPIRED:       { tone: 'err',  label: 'expired' },
  LICENSE_BLOCKED:       { tone: 'err',  label: 'suspended' },
  INVALID_KEY:           { tone: 'err',  label: 'invalid key' },
  NO_LICENSE_FOUND:      { tone: 'err',  label: 'no licence found' },
  NO_LICENSE_DEFINED:    { tone: 'err',  label: 'no licence defined' },
  ALL_LICENSES_ARE_USED: { tone: 'err',  label: 'seat limit reached' },
  TRIAL_PERIOD_ENDED:    { tone: 'err',  label: 'trial ended' },
}

export type LicenceState = {
  tone: PillTone
  label: string
  // Valid and in force.
  live: boolean
  // Definitely bad, as opposed to merely unverifiable. Only this raises the global warning, and
  // it is deliberately not derived from `tone`: colour must follow meaning, never the reverse.
  broken: boolean
}

function licenceState(licence: Licence | null): LicenceState | null {
  // A blank status means no check has produced a verdict: `activeLicence` starts as an empty
  // Licence, and stays one on a marketplace build (which never checks) and on a local-licence
  // -server build with no IPs configured. Nothing to report, and emphatically not a failure.
  const status = licence?.status
  if (!status) return null
  const hit = STATUSES[status]
  // Unknown code: warn, and show it verbatim so it can be looked up.
  if (!hit) return { tone: 'err', label: status, live: false, broken: true }
  return { tone: hit.tone, label: hit.label, live: !!hit.live, broken: !hit.live && !hit.unverified }
}

type Context = {
  licence: Licence | null
  // null when there is nothing to describe: Community, marketplace, or no verdict yet.
  state: LicenceState | null
  // Forces a server-side re-check against the licence server. `POST /server-settings` does not,
  // so without this a saved key reads stale until the backend's own 5-minute cycle.
  recheck: (key: string) => Promise<void>
  // One-shot so the settings dialog doesn't nag on every visit; a recheck re-arms it, so a save
  // that fails to fix the licence says so again.
  warningDismissed: boolean
  dismissWarning: () => void
}

const LicenceContext = createContext<Context | null>(null)

export function LicenceProvider({ children }: { children: ReactNode }) {
  const { data, refresh } = useApi<Licence | null>(
    signal => server.lastLicenceStatus(signal),
    { pollMs: LICENCE_POLL_MS },
  )
  const [warningDismissed, setWarningDismissed] = useState(false)

  const licence = data ?? null

  const recheck = useCallback(async (key: string) => {
    const trimmed = key.trim()
    // A blank key is not a no-op: the backend would check it, fail, and cache INVALID_KEY.
    if (!trimmed) return
    setWarningDismissed(false)
    // Best-effort: on failure the re-read below just returns the unchanged cache, and the poll
    // picks up the truth anyway. Re-reading keeps `useApi` the one owner of this state instead
    // of splicing the response in by hand.
    await server.licenceStatus(trimmed).catch(() => {})
    refresh()
  }, [refresh])

  const value = useMemo<Context>(() => ({
    licence,
    state: licenceState(licence),
    recheck,
    warningDismissed,
    dismissWarning: () => setWarningDismissed(true),
  }), [licence, recheck, warningDismissed])

  return <LicenceContext.Provider value={value}>{children}</LicenceContext.Provider>
}

export function useLicence(): Context {
  const ctx = useContext(LicenceContext)
  if (!ctx) throw new Error('useLicence must be used inside <LicenceProvider>')
  return ctx
}
