import { useState } from 'react'
import { BETA_NOTICE_SEEN_KEY } from '@/components/chrome/beta-notice'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'
import { DangerCallout } from '@/components/shared/danger-callout'
import { Page } from '@/components/shared/page'
import { storage } from '@/lib/localStorage'
import { cn } from '@/lib/utils'
import { useLicence } from './use-licence'
import { ServerTab } from './server-tab'
import { TlsTab } from './tls-tab'
import { UsersTab } from './users-tab'

type Tab = 'server' | 'tls' | 'users'
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'server', label: 'Server', icon: 'cog' },
  { key: 'tls', label: 'TLS / SSL', icon: 'lock' },
  { key: 'users', label: 'Users', icon: 'users' },
]

export function ServerSettingsPage() {
  const [tab, setTab] = useState<Tab>('server')
  return (
    <Page title="Settings" subtitle="Server configuration, TLS certificate, and panel users.">
      <div role="tablist" aria-label="Settings sections" className="flex items-center gap-1 border-b border-[var(--border)] mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn('relative h-9 px-3 text-[13px] inline-flex items-center gap-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-t-[4px]',
              tab === t.key ? 'text-[var(--fg)]' : 'text-[var(--fg-3)] hover:text-[var(--fg-2)]')}
          >
            <Icon name={t.icon} size={13} /> {t.label}
            {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      {tab === 'server' ? <ServerTab /> : tab === 'tls' ? <TlsTab /> : <UsersTab />}
      <LicenceWarningModal onFix={() => setTab('server')} />
    </Page>
  )
}

// The one place that can actually fix a bad licence, so it says so on arrival. Dismissed for the
// session once acknowledged; a save re-arms it, so a key that still doesn't work says so again.
function LicenceWarningModal({ onFix }: { onFix: () => void }) {
  const { state, warningDismissed, dismissWarning } = useLicence()
  // Snapshot at mount rather than subscribe: the welcome dialog is dismissed on the dashboard
  // you land on, so by the time you open Settings this reads true. Landing here directly on a
  // first run just defers the dialog to the next visit; the topbar pill is up the whole time.
  const [betaSeen] = useState(() => storage.readJson(BETA_NOTICE_SEEN_KEY, false))
  const open = betaSeen && state?.broken === true && !warningDismissed
  return (
    <Modal
      open={open}
      onClose={dismissWarning}
      icon="alert"
      title="Licence not valid"
      description="Enterprise features stay disabled until this server has a valid licence."
      width="sm"
      footer={
        <Button variant="primary" size="md" onClick={() => { onFix(); dismissWarning() }}>
          Update licence key
        </Button>
      }
    >
      <DangerCallout icon="alert">
        This server reports its licence as <span className="text-[var(--danger)] font-medium">{state?.label}</span>.
        Enter a valid key under Server, or check it at license.antmedia.io.
      </DangerCallout>
    </Modal>
  )
}
