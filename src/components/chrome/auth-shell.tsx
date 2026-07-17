import { Outlet } from 'react-router'
import { AuthProvider, useAuth } from '@/contexts/auth-context'

export function AuthShell() {
  return (
    <AuthProvider>
      <BootGate />
    </AuthProvider>
  )
}

function BootGate() {
  const { status } = useAuth()
  if (status === 'probing') return <BootScreen />
  return <Outlet />
}

function BootScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--fg-3)]">
      <div className="flex items-center gap-2 text-[12px]">
        <span
          aria-hidden
          className="w-3.5 h-3.5 rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)] animate-spin"
        />
        Loading…
      </div>
    </div>
  )
}
