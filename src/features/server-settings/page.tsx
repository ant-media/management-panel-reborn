import { useState } from 'react'
import { Page } from '@/components/shared/page'
import { Icon, type IconName } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
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
    </Page>
  )
}
