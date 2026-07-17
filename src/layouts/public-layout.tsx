import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/contexts/auth-context'

export function PublicLayout() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center mb-6 gap-2">
          <div className="w-8 h-8 rounded-[7px] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-[13px]">A</div>
          <span className="text-[14px] font-semibold text-[var(--fg)]">Ant Media Server</span>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
