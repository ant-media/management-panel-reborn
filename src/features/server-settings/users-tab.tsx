import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Pill, type PillTone } from '@/components/shared/pill'
import { ActionMenu } from '@/components/shared/action-menu'
import { SearchInput } from '@/components/shared/search-input'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { DangerCallout } from '@/components/shared/danger-callout'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { ToastBanner } from '@/components/shared/toast'
import { useToast } from '@/lib/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { AddUserModal, ChangePasswordModal, EditUserModal } from './user-modals'
import { displayName, removeUser, roleLabel, roleOf, SYSTEM_SCOPE, useUsers, type User } from './use-users'

const ROLE_TONE: Record<string, PillTone> = { ADMIN: 'live', USER: 'neutral', READ_ONLY: 'info' }

export function UsersTab() {
  const { user, isAdmin } = useAuth()
  const myEmail = user?.email ?? ''
  const { data: users, error, isLoading, refresh } = useUsers()
  const { toast, flash, dismiss } = useToast()

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [deleting, setDeleting] = useState<User | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = users ?? []
    if (!q) return list
    return list.filter(u => u.email.toLowerCase().includes(q) || displayName(u).toLowerCase().includes(q))
  }, [users, search])

  const saved = (msg: string) => { setAddOpen(false); setEditUser(null); setPwOpen(false); flash('ok', msg); refresh() }

  if (error && !users) return <LoadErrorBanner entity="users" error={error} onRetry={refresh} />

  return (
    <div className="flex flex-col gap-3">
      {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Filter users…" ariaLabel="Filter users" />
        <div className="flex-1" />
        {myEmail && <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}><Icon name="lock" size={12} /> Change password</Button>}
        {isAdmin && <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}><Icon name="plus" size={12} /> New user</Button>}
      </div>

      {!isAdmin && (
        <div className="text-[11.5px] text-[var(--fg-3)] flex items-center gap-2 px-1">
          <Icon name="info" size={12} /> Administrator access is required to manage users. You can still change your own password.
        </div>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[var(--fg-3)] border-b border-[var(--border)]">
              <th className="text-left font-medium px-4 py-2.5">User</th>
              <th className="text-left font-medium px-3 py-2.5 w-[110px]">Role</th>
              <th className="text-left font-medium px-3 py-2.5 w-[120px]">Scope</th>
              <th className="px-3 py-2.5 w-[52px]" />
            </tr>
          </thead>
          <tbody>
            {isLoading && !users ? (
              <SkeletonRows />
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[12px] text-[var(--fg-3)]">
                {search ? 'No users match your search.' : 'No users.'}
              </td></tr>
            ) : filtered.map(u => {
              const role = roleOf(u)
              const isSelf = u.email === myEmail
              const scope = u.scope && u.scope !== SYSTEM_SCOPE ? u.scope : 'System'
              return (
                <tr key={u.email} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-[var(--bg-3)] flex items-center justify-center text-[10.5px] font-medium text-[var(--fg-2)] shrink-0">{initials(u)}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--fg)] leading-tight truncate flex items-center gap-1.5">
                          {displayName(u)}
                          {isSelf && <Pill tone="info">you</Pill>}
                        </div>
                        <div className="text-[10.5px] text-[var(--fg-3)] font-mono truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{role ? <Pill tone={ROLE_TONE[role] ?? 'neutral'}>{roleLabel(role)}</Pill> : <span className="text-[var(--fg-3)]">-</span>}</td>
                  <td className="px-3 py-2.5 text-[var(--fg-2)]">{scope}</td>
                  <td className="px-3 py-2.5 text-right">
                    {isAdmin && (
                      <ActionMenu items={[
                        { icon: 'edit', label: 'Edit', disabled: isSelf, hint: isSelf ? 'not you' : undefined, onClick: () => setEditUser(u) },
                        'sep',
                        { icon: 'trash', label: 'Delete', danger: true, disabled: isSelf, hint: isSelf ? 'not you' : undefined, onClick: () => setDeleting(u) },
                      ]} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {/* keyed so each open mounts fresh, no stale form state carried across opens */}
      <AddUserModal key={addOpen ? 'add-open' : 'add'} open={addOpen} onClose={() => setAddOpen(false)} onSaved={saved} />
      <EditUserModal key={editUser?.email ?? 'edit'} open={!!editUser} user={editUser} onClose={() => setEditUser(null)} onSaved={saved} />
      <ChangePasswordModal key={pwOpen ? 'pw-open' : 'pw'} open={pwOpen} email={myEmail} onClose={() => setPwOpen(false)} onSaved={saved} />

      {deleting && (
        <ConfirmModal
          title="Delete user"
          confirmLabel="Delete user"
          busyLabel="Deleting…"
          errorFallback="Could not delete the user. The server gave no reason. Check the server logs."
          autoFocus="cancel"
          onConfirm={() => removeUser(deleting.email)}
          onDone={() => { flash('ok', `User ${deleting.email} deleted.`); refresh() }}
          onClose={() => setDeleting(null)}
        >
          <DangerCallout icon="trash">
            Delete <span className="font-semibold text-[var(--danger)]">{deleting.email}</span>? They lose panel access
            immediately. This can’t be undone.
          </DangerCallout>
        </ConfirmModal>
      )}
    </div>
  )
}

function initials(u: User): string {
  const name = displayName(u)
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function SkeletonRows() {
  return <>{Array.from({ length: 3 }).map((_, i) => (
    <tr key={i} className="border-b border-[var(--border)]">
      <td className="px-4 py-3" colSpan={4}><div className="h-6 rounded bg-[var(--bg-2)] animate-pulse" /></td>
    </tr>
  ))}</>
}
