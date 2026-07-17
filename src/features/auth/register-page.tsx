import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { AuthField, FormError } from './form'

export function RegisterPage() {
  const { status, registerFirstAdmin } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // After a successful submit, status flips to 'unauthenticated' but we keep the
  // user on this page to show the success card. The done check runs first so the
  // status guard doesn't yank them straight to /login.
  if (done) {
    return (
      <Card className="p-6">
        <h1 className="text-[15px] font-medium text-[var(--fg)] mb-1">Administrator created</h1>
        <p className="text-[12px] text-[var(--fg-3)] mb-5">Sign in with the credentials you just set.</p>
        <Button variant="primary" size="md" onClick={() => void navigate('/login', { replace: true })}>
          Continue to sign in
        </Button>
      </Card>
    )
  }

  if (status !== 'first-login') return <Navigate to="/login" replace />

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const ok = await registerFirstAdmin(email, password)
      if (!ok) { setError('Unable to create administrator. Try again.'); return }
      setDone(true)
    } catch (err) {
      setError(errorMessage(err, 'Unable to create administrator.'))
    } finally {
      setSubmitting(false)
    }
  }

  const clearError = () => { if (error) setError(null) }

  return (
    <Card className="p-6">
      <h1 className="text-[15px] font-medium text-[var(--fg)] mb-1">Create first administrator</h1>
      <p className="text-[12px] text-[var(--fg-3)] mb-5">No accounts exist on this server yet. Set the administrator credentials.</p>
      <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
        <AuthField
          label="Email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          value={email}
          onChange={v => { setEmail(v); clearError() }}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={v => { setPassword(v); clearError() }}
        />
        <AuthField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={v => { setConfirm(v); clearError() }}
        />
        <FormError message={error} />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={submitting || !email || !password || !confirm}
        >
          {submitting ? 'Creating…' : 'Create administrator'}
        </Button>
      </form>
    </Card>
  )
}
