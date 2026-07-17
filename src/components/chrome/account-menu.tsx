import { useEffect } from 'react'
import { Icon } from '@/components/ui/icon'
import { useAuth } from '@/contexts/auth-context'

type Props = { open: boolean; onClose: () => void }

export function AccountMenu({ open, onClose }: Props) {
  const { user, isAdmin, logout } = useAuth()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const role = isAdmin ? 'Administrator' : 'Application user'

  const onSignOut = () => {
    onClose()
    void logout()
  }

  return (
    <>
      {/* Backdrop catches outside clicks. Sits below the menu, above page content. */}
      <div onClick={onClose} className="fixed inset-0 z-40" aria-hidden />
      <div
        role="menu"
        className="absolute bottom-full left-2 mb-1.5 w-[220px] bg-[var(--card)] border border-[var(--border)] rounded-[8px] shadow-xl overflow-hidden z-50"
      >
        <div className="px-3 py-2.5 border-b border-[var(--border)]">
          <div className="text-[12px] font-medium text-[var(--fg)] truncate" title={user?.email}>
            {user?.email ?? 'Unknown user'}
          </div>
          <div className="text-[10.5px] text-[var(--fg-3)] mt-0.5">{role}</div>
        </div>
        <button
          type="button"
          role="menuitem"
          onClick={onSignOut}
          className="w-full px-3 py-2 flex items-center gap-2 text-[12px] text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)] outline-none focus-visible:bg-[var(--bg-2)] transition-colors"
        >
          <Icon name="power" size={12} />
          Sign out
        </button>
      </div>
    </>
  )
}
