import { useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Sidebar } from '@/components/chrome/sidebar'
import { Topbar } from '@/components/chrome/topbar'
import { ConnectionBanner } from '@/components/chrome/connection-banner'
import { BetaNotice } from '@/components/chrome/beta-notice'
import { ThemeProvider } from '@/contexts/theme-context'
import { useAuth } from '@/contexts/auth-context'
import { ConnectionProvider } from '@/contexts/connection-context'
import { SidebarContext } from '@/contexts/sidebar-context'
import { ApplicationsProvider } from '@/features/apps/use-applications'
import { LicenceWarningModal } from '@/features/server-settings/licence-warning-modal'
import { LicenceProvider } from '@/features/server-settings/use-licence'

export function ProtectedLayout() {
  const { status } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const sidebar = useMemo(() => ({ collapsed, setCollapsed }), [collapsed])

  if (status === 'first-login') return <Navigate to="/register" replace />
  if (status !== 'authenticated') {
    const from = location.pathname + location.search
    return <Navigate to="/login" replace state={{ from }} />
  }

  return (
    <ThemeProvider>
      <ApplicationsProvider>
        <LicenceProvider>
          <ConnectionProvider>
            <SidebarContext.Provider value={sidebar}>
              <div className="h-screen flex bg-[var(--bg)] text-[var(--fg)] overflow-hidden">
                <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
                <main className="flex-1 flex flex-col min-w-0 relative">
                  <Topbar />
                  <ConnectionBanner />
                  <div className="flex-1 overflow-auto relative">
                    <Outlet />
                  </div>
                </main>
                <LicenceWarningModal key={location.pathname} />
                <BetaNotice />
              </div>
            </SidebarContext.Provider>
          </ConnectionProvider>
        </LicenceProvider>
      </ApplicationsProvider>
    </ThemeProvider>
  )
}
