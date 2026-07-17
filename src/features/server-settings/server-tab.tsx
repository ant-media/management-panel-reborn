import { useEffect, useState, type ReactNode } from 'react'
import { resultMessage } from '@/lib/api'
import { useApi } from '@/lib/api/use-api'
import { server, system } from '@/lib/api/endpoints'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/shared/pill'
import { Field, SelectField } from '@/components/shared/form'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { ToastBanner } from '@/components/shared/toast'
import { useToast } from '@/lib/use-toast'
import { LOG_LEVELS, saveServerSettings, useServerSettings, type ServerSettings } from './use-server-settings'

type VersionInfo = { versionName?: string; versionType?: string; buildNumber?: string }
type LicenceInfo = { status?: string; type?: string; owner?: string; endDate?: string }

export function ServerTab() {
  const { data, error, isLoading, refresh } = useServerSettings()
  const version = useApi<VersionInfo>(signal => system.version(signal))
  // Edition comes from the endpoint that answers exactly that, not from sniffing `versionType`
  // (a display string). Same source as the app-settings rule context.
  const edition = useApi(signal => server.enterpriseEdition(signal))
  // /licence-status comes back empty on a live server; the populated Licence is at /last-licence-status.
  const licence = useApi<LicenceInfo>(signal => server.lastLicenceStatus(signal) as Promise<LicenceInfo>)
  const { toast, flash, dismiss } = useToast()

  const [baseline, setBaseline] = useState<ServerSettings | null>(null)
  const [draft, setDraft] = useState<ServerSettings | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (data) { setBaseline(data); setDraft(data) } }, [data])

  if (error && !draft) return <LoadErrorBanner entity="server settings" error={error} onRetry={refresh} />
  if (!draft || !baseline || isLoading) return <SettingsSkeleton />

  // Unknown (probe in flight or failed) hides the licence key, same as Community.
  const isEnterprise = edition.data?.success === true
  const marketBuild = draft.buildForMarket === true
  const showLicenceKey = isEnterprise && !marketBuild

  // logLevel + licenceKey are the only edits the POST actually persists.
  const dirty = draft.logLevel !== baseline.logLevel || draft.licenceKey !== baseline.licenceKey
  const set = (patch: Partial<ServerSettings>) => setDraft(d => (d ? { ...d, ...patch } : d))

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    const res = await saveServerSettings(draft)
    setSaving(false)
    // Keep the draft on failure so edits survive; no refetch on success (the POST
    // returns only {success} and a refetch would race a fresh edit, Phase 11 lesson).
    if (res.success) { setBaseline(draft); flash('ok', 'Server settings saved.') }
    else {
      const why = resultMessage(res)
      flash('err', why ? `Save failed: ${why}` : 'Save failed. Your changes are kept, so you can retry.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}

      {/* Read-only identity / license */}
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[12.5px]">
          <InfoRow label="Version">
            <span className="font-mono">{version.data?.versionName ?? '-'}</span>
            {version.data?.versionType && <span className="text-[var(--fg-3)]"> · {version.data.versionType}</span>}
          </InfoRow>
          <InfoRow label="Build"><span className="font-mono">{version.data?.buildNumber ?? '-'}</span></InfoRow>
          <InfoRow label="Host"><span className="font-mono">{draft.hostAddress || '-'}</span></InfoRow>
          <InfoRow label="HTTP port"><span className="font-mono">{draft.defaultHttpPort ?? '-'}</span></InfoRow>
          <InfoRow label="TLS">
            {draft.sslEnabled ? <Pill tone="ok" dot>enabled</Pill> : <Pill tone="neutral" dot>disabled</Pill>}
          </InfoRow>
          {isEnterprise && (
            <InfoRow label="License"><LicenceBadge licence={licence.data} marketBuild={marketBuild} /></InfoRow>
          )}
        </div>
        {!isEnterprise && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] text-[11.5px] text-[var(--fg-3)]">
            Community Edition, no license activation required.
          </div>
        )}
      </Card>

      {/* Editable */}
      <Card className="p-5 flex flex-col gap-4">
        <SelectField
          label="Log level"
          hint="Verbosity of the server log. Applies immediately on save."
          value={String(draft.logLevel ?? 'INFO')}
          onChange={v => set({ logLevel: v })}
          options={LOG_LEVELS}
        />
        {showLicenceKey && (
          <Field
            label="License key"
            mono
            placeholder="Enter your enterprise license key"
            hint="The key from your Ant Media account."
            value={String(draft.licenceKey ?? '')}
            onChange={v => set({ licenceKey: v })}
          />
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          {dirty && <span className="text-[11.5px] text-[var(--warn)] mr-auto inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)]" /> Unsaved changes</span>}
          <Button variant="primary" size="md" onClick={save} disabled={!dirty || saving}>
            {saving && <Icon name="refresh" size={12} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-[var(--fg-3)] w-[72px] shrink-0">{label}</span>
      <span className="text-[var(--fg)] truncate">{children}</span>
    </div>
  )
}

function LicenceBadge({ licence, marketBuild }: { licence: LicenceInfo | null; marketBuild: boolean }) {
  if (marketBuild) return <Pill tone="ok" dot>marketplace</Pill>
  if (!licence) return <span className="text-[var(--fg-3)]">-</span>
  const valid = licence.status === 'OK' || licence.status === 'Valid'
  return (
    <span className="inline-flex items-center gap-2">
      <Pill tone={valid ? 'ok' : 'err'} dot>{valid ? 'active' : (licence.status ?? 'invalid')}</Pill>
      {valid && licence.endDate && <span className="text-[var(--fg-3)] text-[11.5px]">until {licence.endDate}</span>}
    </span>
  )
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[88, 180].map((h, i) => (
        <div key={i} className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-2)] animate-pulse" style={{ height: h }} />
      ))}
    </div>
  )
}
