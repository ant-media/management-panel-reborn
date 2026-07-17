import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Page } from '@/components/shared/page'
import { Pill } from '@/components/shared/pill'
import { SearchInput } from '@/components/shared/search-input'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { fmtBytes } from '@/lib/format'
import { ConfirmDeleteModal } from './confirm-delete-modal'
import { NewAppModal } from './new-app-modal'
import { useApplications, type ApplicationInfo } from './use-applications'

export function AppsPage() {
  const { apps, error, isLoading, refresh } = useApplications()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!apps) return null
    const q = search.trim().toLowerCase()
    return q ? apps.filter(a => a.name.toLowerCase().includes(q)) : apps
  }, [apps, search])

  const total = apps?.length ?? 0
  const liveCount = (apps ?? []).reduce((sum, a) => sum + (a.liveStreamCount > 0 ? 1 : 0), 0)

  return (
    <Page
      title="Applications"
      subtitle={apps == null
        ? (isLoading ? 'Loading…' : '-')
        : <>
            {total} installed
            {liveCount > 0 && <> · <span className="text-[var(--accent)]">{liveCount}</span> with live streams</>}
          </>}
      actions={
        <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}><Icon name="plus" size={12} /> New application</Button>
      }
    >
      {error && <LoadErrorBanner entity="applications" error={error} onRetry={refresh} className="mb-5" />}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
          <SearchInput
            size="sm"
            className="flex-1 max-w-[280px]"
            value={search}
            onChange={setSearch}
            placeholder="Filter applications…"
            ariaLabel="Filter applications"
          />
          {search && filtered && filtered.length !== total && (
            <div className="text-[11.5px] text-[var(--fg-3)]">Showing {filtered.length} of {total}</div>
          )}
        </div>

        {apps == null ? (
          <EmptyState icon="box" title={isLoading ? 'Loading applications…' : 'No data'} />
        ) : filtered && filtered.length === 0 ? (
          search
            ? <EmptyState icon="search" title="No matches" subtitle={`No application name contains "${search}"`} />
            : <EmptyState
                icon="box"
                title="No applications installed"
                subtitle="Create a streaming endpoint to get started."
                action={<Button variant="primary" size="md" onClick={() => setNewOpen(true)}><Icon name="plus" size={12} /> New application</Button>}
              />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--fg-3)] border-b border-[var(--border)]">
                <th className="text-left  font-medium px-5 py-2.5">Name</th>
                <th className="text-right font-medium px-5 py-2.5">Live streams</th>
                <th className="text-right font-medium px-5 py-2.5">VoD count</th>
                <th className="text-right font-medium px-5 py-2.5">Storage</th>
                <th className="text-right font-medium px-5 py-2.5 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {(filtered ?? []).map(a => (
                <AppRow
                  key={a.name}
                  app={a}
                  onOpen={() => void navigate(`/apps/${encodeURIComponent(a.name)}`)}
                  onDelete={() => setPendingDelete(a.name)}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <NewAppModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={name => void navigate(`/apps/${encodeURIComponent(name)}`)}
      />
      {pendingDelete && (
        <ConfirmDeleteModal
          appName={pendingDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </Page>
  )
}

function AppRow({ app, onOpen, onDelete }: { app: ApplicationInfo; onOpen: () => void; onDelete: () => void }) {
  return (
    <tr
      onClick={onOpen}
      className="group border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)] cursor-pointer transition-colors"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Icon name="box" size={14} className="text-[var(--fg-3)]" />
          <span className="font-medium text-[var(--fg)]">{app.name}</span>
          {app.liveStreamCount > 0 && <Pill tone="live" dot>live</Pill>}
        </div>
      </td>
      <td className="px-5 py-3 text-right font-mono tabular-nums">
        {app.liveStreamCount > 0
          ? <span className="text-[var(--accent)] font-medium">{app.liveStreamCount}</span>
          : <span className="text-[var(--fg-3)]">0</span>}
      </td>
      <td className="px-5 py-3 text-right font-mono tabular-nums text-[var(--fg-2)]">{app.vodCount}</td>
      <td className="px-5 py-3 text-right font-mono tabular-nums text-[var(--fg-2)]">{fmtBytes(app.storage)}</td>
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          aria-label={`Delete ${app.name}`}
          title="Delete"
          className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] text-[var(--fg-3)] opacity-0 group-hover:opacity-100 hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] transition-all outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Icon name="trash" size={13} />
        </button>
      </td>
    </tr>
  )
}

function EmptyState({ icon, title, subtitle, action }: { icon: 'box' | 'search'; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-[var(--bg-2)] flex items-center justify-center">
        <Icon name={icon} size={20} className="text-[var(--fg-3)]" />
      </div>
      <div>
        <div className="text-[13.5px] font-medium text-[var(--fg)]">{title}</div>
        {subtitle && <div className="text-[12px] text-[var(--fg-3)] mt-1">{subtitle}</div>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
