import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/contexts/auth-context'

// Pages whose whole backend is 403 for app-scoped users.
export function SystemOnly() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}
