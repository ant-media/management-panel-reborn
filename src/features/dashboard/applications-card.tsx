import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import type { ApplicationInfo } from '@/features/apps/use-applications'
import { AppRow } from './app-row'

type Props = {
  apps: ApplicationInfo[] | null
  isLoading: boolean
  onNewApp: () => void
}

export function ApplicationsCard({ apps, isLoading, onNewApp }: Props) {
  const navigate = useNavigate()
  const rows = apps ?? []
  const goToApp = (name: string) => void navigate(`/apps/${encodeURIComponent(name)}`)

  return (
    <Card className="overflow-hidden transition-all hover:border-[var(--border-strong)] hover:shadow-xs">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[var(--fg)] tracking-tight">Applications</div>
          <div className="text-[12px] text-[var(--fg-3)] mt-0.5">
            {apps == null
              ? (isLoading ? 'Loading…' : 'No data')
              : `${rows.length} ${rows.length === 1 ? 'application' : 'applications'} · click a row for detail`}
          </div>
        </div>
        <Button variant="primary" size="md" onClick={onNewApp}>
          <Icon name="plus" size={13} /> New application
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center text-[12.5px] text-[var(--fg-3)]">
          {isLoading ? 'Loading applications…' : 'No applications installed.'}
        </div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[var(--fg-3)] border-b border-[var(--border)]">
              <th className="text-left  font-medium px-6 py-2.5 w-10"></th>
              <th className="text-left  font-medium px-6 py-2.5">Name</th>
              <th className="text-right font-medium px-6 py-2.5">Live streams</th>
              <th className="text-right font-medium px-6 py-2.5">VoD count</th>
              <th className="text-right font-medium px-6 py-2.5">Storage</th>
              <th className="text-right font-medium px-6 py-2.5 w-36">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <AppRow key={a.name} app={a} onOpen={goToApp} />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
