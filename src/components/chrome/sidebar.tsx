import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { Icon, type IconName } from '@/components/ui/icon'
import { AccountMenu } from '@/components/chrome/account-menu'
import { useAuth } from '@/contexts/auth-context'
import { NewAppModal } from '@/features/apps/new-app-modal'
import { useApplications } from '@/features/apps/use-applications'
import { useApi } from '@/lib/api/use-api'
import { server } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

type NavItem = { to: string; icon: IconName; label: string; end?: boolean }

const SECONDARY: NavItem[] = [
  { to: '/cluster',  icon: 'cluster',  label: 'Cluster' },
  { to: '/settings', icon: 'settings', label: 'Server settings' },
  { to: '/logs',     icon: 'logs',     label: 'Logs' },
  { to: '/support',  icon: 'support',  label: 'Support' },
]

type Props = {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const [appsOpen, setAppsOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [newAppOpen, setNewAppOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin } = useAuth()
  const { apps, isLoading } = useApplications()
  // Edition line under the title. Blank until the probe resolves so we never flash the wrong one.
  const edition = useApi(signal => server.enterpriseEdition(signal))
  const editionLabel = edition.data ? (edition.data.success ? 'Enterprise Edition' : 'Community Edition') : ''

  const appsActive = location.pathname.startsWith('/apps')
  const appList = apps ?? []
  const filteredApps = search
    ? appList.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : appList
  const totalLive = appList.reduce((sum, a) => sum + (a.liveStreamCount ?? 0), 0)
  const primary: NavItem[] = [
    { to: '/', icon: 'dashboard', label: 'Dashboard', end: true },
  ]

  return (
    <aside className={cn(
      'shrink-0 h-full flex flex-col border-r border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ease-out',
      collapsed ? 'w-[60px]' : 'w-[256px]',
    )}>
      <div className={cn('h-12 flex items-center border-b border-[var(--border)] shrink-0', collapsed ? 'justify-center' : 'px-3 gap-2')}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-8 h-8 rounded-[7px] bg-[var(--accent)] text-white flex items-center justify-center shrink-0 font-bold text-[13px] tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          A
        </button>
        {!collapsed && (
          <>
            <Link
              to="/"
              title="Go to dashboard"
              className="min-w-0 rounded hover:opacity-80 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <div className="text-[12.5px] font-semibold text-[var(--fg)] leading-none whitespace-nowrap">Ant Media Server</div>
              <div className="text-[10.5px] text-[var(--fg-3)] mt-1 whitespace-nowrap">{editionLabel || ' '}</div>
            </Link>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="ml-auto w-6 h-6 rounded text-[var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[var(--fg-2)] flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Icon name="chevron-left" size={12} />
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5 min-h-0" aria-label="Primary">
        {primary.map(item => <NavRow key={item.to} item={item} collapsed={collapsed} />)}

        <div>
          <div
            className={cn(
              'w-full h-8 rounded-[6px] flex items-stretch text-[12.5px] transition-colors',
              appsActive ? 'bg-[var(--bg-2)] text-[var(--fg)] font-medium' : 'text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]',
            )}
          >
            <NavLink
              to="/apps"
              end
              title={collapsed ? 'Applications' : undefined}
              onClick={() => !collapsed && setAppsOpen(true)}
              className="flex-1 flex items-center gap-2 px-2 rounded-l-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] min-w-0"
            >
              <Icon name="box" size={14} className={cn('shrink-0', appsActive ? 'text-[var(--accent)]' : 'text-[var(--fg-3)]')} />
              {!collapsed && <span className="flex-1 text-left truncate">Applications</span>}
              {!collapsed && totalLive > 0 && (
                <LiveBadge count={totalLive} title={`${totalLive} live stream${totalLive === 1 ? '' : 's'}`} />
              )}
            </NavLink>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setAppsOpen(o => !o)}
                aria-expanded={appsOpen}
                aria-label={appsOpen ? 'Collapse applications list' : 'Expand applications list'}
                className="px-2 flex items-center rounded-r-[6px] text-[var(--fg-3)] hover:text-[var(--fg-2)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Icon name={appsOpen ? 'chevron-down' : 'chevron-right'} size={11} />
              </button>
            )}
          </div>
          {!collapsed && appsOpen && (
            <div className="mt-1 ml-3 pl-2.5 border-l border-[var(--border)] flex flex-col gap-px">
              <div className="px-1.5 pt-1 pb-1.5 flex items-center gap-1">
                <div className="relative flex-1">
                  <Icon name="search" size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--fg-3)]" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Filter apps…"
                    aria-label="Filter applications"
                    className="w-full h-7 pl-7 pr-2 text-[11.5px] bg-[var(--bg-2)] border border-[var(--border)] focus:border-[var(--border-strong)] rounded-[5px] outline-none text-[var(--fg)] placeholder:text-[var(--fg-3)]"
                  />
                </div>
                <button
                  type="button"
                  aria-label="New application"
                  onClick={() => setNewAppOpen(true)}
                  className="w-7 h-7 shrink-0 rounded-[5px] bg-[var(--accent)] text-white hover:brightness-110 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <Icon name="plus" size={12} />
                </button>
              </div>
              {filteredApps.map(app => (
                <NavLink
                  key={app.name}
                  to={`/apps/${encodeURIComponent(app.name)}`}
                  title={`${app.name}\n${app.liveStreamCount} live · ${app.vodCount} VoD`}
                  className={({ isActive }) => cn(
                    'w-full h-7 rounded-[5px] flex items-center gap-2 px-2 text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                    isActive ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-medium' : 'text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]',
                  )}
                >
                  <Icon name="file" size={11} className="shrink-0 text-[var(--fg-3)]" />
                  <span className="flex-1 text-left truncate">{app.name}</span>
                  {app.liveStreamCount > 0 && <LiveBadge count={app.liveStreamCount} />}
                </NavLink>
              ))}
              {filteredApps.length === 0 && (
                <div className="px-2 py-1.5 text-[11px] text-[var(--fg-3)]">
                  {apps == null ? (isLoading ? 'Loading…' : 'No data') : search ? 'No matches' : 'No applications'}
                </div>
              )}
            </div>
          )}
        </div>

        {SECONDARY.map(item => <NavRow key={item.to} item={item} collapsed={collapsed} />)}
      </nav>

      <div className={cn('relative shrink-0 border-t border-[var(--border)] p-2', collapsed && 'flex justify-center')}>
        <button
          type="button"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          onClick={() => setAccountOpen(o => !o)}
          className={cn(
            'h-9 rounded-[6px] flex items-center gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            collapsed ? 'w-9 justify-center' : 'w-full px-2',
            accountOpen ? 'bg-[var(--bg-2)] text-[var(--fg)]' : 'text-[var(--fg-2)] hover:bg-[var(--bg-2)]',
          )}
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--info)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {user?.email?.[0]?.toUpperCase() ?? 'A'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[12px] font-medium text-[var(--fg)] truncate leading-tight" title={user?.email}>
                  {user?.email ?? 'Unknown'}
                </div>
                <div className="text-[10.5px] text-[var(--fg-3)] truncate">{isAdmin ? 'Administrator' : 'App user'}</div>
              </div>
              <Icon name="more-h" size={12} className="text-[var(--fg-3)]" />
            </>
          )}
        </button>
        <AccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
      </div>

      <NewAppModal
        open={newAppOpen}
        onClose={() => setNewAppOpen(false)}
        onCreated={name => void navigate(`/apps/${encodeURIComponent(name)}`)}
      />
    </aside>
  )
}

// Red glowing live-stream count pill: shared by the Applications header + each app row.
function LiveBadge({ count, title }: { count: number; title?: string }) {
  return (
    <span
      title={title}
      className="shrink-0 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--live)] text-white text-[9.5px] font-bold tabular-nums leading-none inline-flex items-center justify-center shadow-[0_0_0_2px_var(--live-glow)]"
    >
      {count}
    </span>
  )
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => cn(
        'w-full h-8 rounded-[6px] flex items-center gap-2 px-2 text-[12.5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        isActive ? 'bg-[var(--bg-2)] text-[var(--fg)] font-medium' : 'text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]',
      )}
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} size={14} className={cn('shrink-0', isActive ? 'text-[var(--accent)]' : 'text-[var(--fg-3)]')} />
          {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
}
