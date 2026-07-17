import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Field, SelectField, FormError } from '@/components/shared/form'
import { resultError } from '@/lib/api'
import { addUser, changeMyPassword, editUser, roleOf, ROLE_OPTIONS, type User, type UserRole } from './use-users'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MIN_PW = 6
const asRole = (r: string): UserRole => (r === 'ADMIN' || r === 'READ_ONLY' ? r : 'USER')

// Footer shared by all three modals.
function Footer({ onCancel, onSubmit, submitting, submitLabel, disabled }: {
  onCancel: () => void; onSubmit: () => void; submitting: boolean; submitLabel: string; disabled?: boolean
}) {
  return (
    <>
      <Button variant="ghost" size="md" onClick={onCancel} disabled={submitting}>Cancel</Button>
      <Button variant="primary" size="md" onClick={onSubmit} disabled={submitting || disabled}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </>
  )
}

export function AddUserModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [firstName, setFirst] = useState('')
  const [lastName, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState<UserRole>('USER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (firstName.trim().length < 2 || lastName.trim().length < 2) return setError('First and last name are required.')
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid e-mail address.')
    if (password.length < MIN_PW) return setError(`Password must be at least ${MIN_PW} characters.`)
    if (password !== confirm) return setError('Passwords do not match.')
    setError(null); setSubmitting(true)
    const res = await addUser({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim(), role })
    setSubmitting(false)
    if (res.success) onSaved(`User ${email.trim()} created.`)
    else setError(resultError(res, 'Could not create the user.'))
  }

  return (
    <Modal open={open} onClose={onClose} title="New user" width="md" dismissible={!submitting}
      footer={<Footer onCancel={onClose} onSubmit={submit} submitting={submitting} submitLabel="Create user" />}>
      <div className="flex flex-col gap-3.5">
        {error && <FormError>{error}</FormError>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required value={firstName} onChange={setFirst} autoFocus />
          <Field label="Last name" required value={lastName} onChange={setLast} />
        </div>
        <Field label="E-mail" required mono placeholder="user@example.com" value={email} onChange={setEmail} autoComplete="off" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" required type="password" value={password} onChange={setPassword} autoComplete="new-password" hint={`Min ${MIN_PW} characters`} />
          <Field label="Confirm password" required type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        <SelectField label="Role" value={role} onChange={v => setRole(asRole(v))} options={ROLE_OPTIONS}
          hint="Admin manages everything · User edits streams/VoDs · Read-only views only." />
      </div>
    </Modal>
  )
}

// Parent remounts this per-target via `key`, so state seeds cleanly from `user`.
export function EditUserModal({ open, user, onClose, onSaved }: { open: boolean; user: User | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [role, setRole] = useState<UserRole>(asRole(user ? roleOf(user) : 'USER'))
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!user) return null

  const submit = async () => {
    if (newPassword && newPassword.length < MIN_PW) return setError(`Password must be at least ${MIN_PW} characters.`)
    if (newPassword && newPassword !== confirm) return setError('Passwords do not match.')
    setError(null); setSubmitting(true)
    const res = await editUser(user.email, role, newPassword || undefined)
    setSubmitting(false)
    if (res.success) onSaved(`User ${user.email} updated.`)
    else setError(resultError(res, 'Could not update the user.'))
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit user" description={user.email} width="md" dismissible={!submitting}
      footer={<Footer onCancel={onClose} onSubmit={submit} submitting={submitting} submitLabel="Save changes" />}>
      <div className="flex flex-col gap-3.5">
        {error && <FormError>{error}</FormError>}
        <SelectField label="Role" value={role} onChange={v => setRole(asRole(v))} options={ROLE_OPTIONS} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="New password" optional type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" hint="Leave blank to keep current" />
          <Field label="Confirm password" optional type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
      </div>
    </Modal>
  )
}

export function ChangePasswordModal({ open, email, onClose, onSaved }: { open: boolean; email: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const [oldPassword, setOld] = useState('')
  const [newPassword, setNew] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!oldPassword) return setError('Enter your current password.')
    if (newPassword.length < MIN_PW) return setError(`New password must be at least ${MIN_PW} characters.`)
    if (newPassword !== confirm) return setError('Passwords do not match.')
    setError(null); setSubmitting(true)
    const res = await changeMyPassword(email, oldPassword, newPassword)
    setSubmitting(false)
    if (res.success) { setOld(''); setNew(''); setConfirm(''); onSaved('Password changed.') }
    else setError(resultError(res, 'Could not change the password. Check your current password.'))
  }

  return (
    <Modal open={open} onClose={onClose} title="Change password" description={email} width="sm" dismissible={!submitting}
      footer={<Footer onCancel={onClose} onSubmit={submit} submitting={submitting} submitLabel="Change password" />}>
      <div className="flex flex-col gap-3.5">
        {error && <FormError>{error}</FormError>}
        <Field label="Current password" required type="password" value={oldPassword} onChange={setOld} autoComplete="current-password" autoFocus />
        <Field label="New password" required type="password" value={newPassword} onChange={setNew} autoComplete="new-password" hint={`Min ${MIN_PW} characters`} />
        <Field label="Confirm new password" required type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </div>
    </Modal>
  )
}
