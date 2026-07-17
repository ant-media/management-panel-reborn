import { Outlet, Route, createHashRouter, createRoutesFromElements } from 'react-router'
import { AuthShell } from '@/components/chrome/auth-shell'
import { ProtectedLayout } from '@/layouts/protected-layout'
import { PublicLayout } from '@/layouts/public-layout'
import { DashboardPage } from '@/features/dashboard/page'
import { AppsPage } from '@/features/apps/page'
import { AppDetailPage } from '@/features/apps/detail-page'
import { ClusterPage } from '@/features/cluster/page'
import { ServerSettingsPage } from '@/features/server-settings/page'
import { LogsPage } from '@/features/logs/page'
import { SupportPage } from '@/features/support/page'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { NotFoundPage } from '@/features/not-found/page'
import { UiSinkPage } from '@/features/ui-sink/page'

// HashRouter: routes after `#` stay in the browser only, so the AMS backend
// never sees them. This guarantees zero collision with `/{appName}/` URLs
// (any app name AMS accepts is alphanumeric, so it could never look like `#`).
export const router = createHashRouter(
  createRoutesFromElements(
    <>
      <Route element={<AuthShell />}>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} handle={{ breadcrumb: 'Dashboard' }} />
          <Route path="/apps" element={<Outlet />} handle={{ breadcrumb: 'Applications' }}>
            <Route index element={<AppsPage />} />
            <Route path=":name" element={<AppDetailPage />} handle={{ breadcrumb: (p: { name?: string }) => p.name ?? '' }} />
          </Route>
          <Route path="/cluster" element={<ClusterPage />} handle={{ breadcrumb: 'Cluster' }} />
          <Route path="/settings" element={<ServerSettingsPage />} handle={{ breadcrumb: 'Server settings' }} />
          <Route path="/logs" element={<LogsPage />} handle={{ breadcrumb: 'Logs' }} />
          <Route path="/support" element={<SupportPage />} handle={{ breadcrumb: 'Support' }} />
          <Route path="*" element={<NotFoundPage />} handle={{ breadcrumb: 'Not found' }} />
        </Route>
      </Route>

      {/* /ui-sink stays outside AuthShell: it's a primitives reference, used without backend. */}
      <Route path="/ui-sink" element={<UiSinkPage />} />
    </>,
  ),
)
