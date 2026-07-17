import { useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Sidebar } from '@/components/chrome/sidebar'
import { Topbar } from '@/components/chrome/topbar'
import { Notifications } from '@/components/chrome/notifications'
import { TweaksPanel } from '@/components/chrome/tweaks-panel'
import { ConnectionBanner } from '@/components/chrome/connection-banner'
import { ThemeProvider } from '@/contexts/theme-context'
import { useAuth } from '@/contexts/auth-context'
import { ConnectionProvider } from '@/contexts/connection-context'
import { SidebarContext } from '@/contexts/sidebar-context'
import { ApplicationsProvider } from '@/features/apps/use-applications'

export function ProtectedLayout() {
  const { status } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const sidebar = useMemo(() => ({ collapsed, setCollapsed }), [collapsed])

  if (status === 'first-login') return <Navigate to="/register" replace />
  if (status !== 'authenticated') {
    const from = location.pathname + location.search
    return <Navigate to="/login" replace state={{ from }} />
  }

  return (
    <ThemeProvider>
      <ApplicationsProvider>
        <ConnectionProvider>
          <SidebarContext.Provider value={sidebar}>
            <div className="h-screen flex bg-[var(--bg)] text-[var(--fg)] overflow-hidden">
              <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
              <main className="flex-1 flex flex-col min-w-0 relative">
                <Topbar
                  onOpenNotifs={() => setNotifOpen(true)}
                  onOpenTweaks={() => setTweaksOpen(true)}
                  notifCount={0}
                />
                <ConnectionBanner />
                <div className="flex-1 overflow-auto relative">
                  <Outlet />
                </div>
              </main>
              <Notifications open={notifOpen} onClose={() => setNotifOpen(false)} />
              <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
            </div>
          </SidebarContext.Provider>
        </ConnectionProvider>
      </ApplicationsProvider>
    </ThemeProvider>
  )
}
