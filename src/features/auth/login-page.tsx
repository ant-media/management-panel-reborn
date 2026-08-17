import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { AuthField, DOOR_CARD, FormError } from './form'

export function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'first-login') return <Navigate to="/register" replace />

  // ProtectedLayout stashes the path the user was on before being kicked out,
  // so we can land them back there after a successful sign-in.
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const ok = await login(email, password)
      if (!ok) { setError('Incorrect email or password.'); return }
      void navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in.'))
    } finally {
      setSubmitting(false)
    }
  }

  const clearError = () => { if (error) setError(null) }

  return (
    <>
      <PanelSwitch />
      <Card className={DOOR_CARD}>
        <h1 className="text-[15px] font-medium text-[var(--fg)] mb-1">Sign in</h1>
        <p className="text-[12px] text-[var(--fg-3)] mb-5">Use your administrator account.</p>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={v => { setPassword(v); clearError() }}
          />
          <FormError message={error} />
          <Button type="submit" variant="primary" size="md" disabled={submitting || !email || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </>
  )
}

// The classic console owns the origin root; this panel ships in a subfolder beside it.
function PanelSwitch() {
  const opt = 'h-[30px] px-4 flex items-center gap-1.5 rounded-full border text-[12.5px] font-medium transition-colors'
  return (
    <div className="w-max mx-auto mb-4 flex p-[3px] rounded-full bg-[var(--bg-2)] border border-[var(--border)]">
      <a href="/" className={`${opt} border-transparent text-[var(--fg-3)] hover:text-[var(--fg)]`}>Classic</a>
      <span className={`${opt} border-[var(--border)] bg-[var(--card)] text-[var(--fg)]`}>
        New UI
        <span className="px-1 py-0.5 rounded-[3px] bg-[var(--bg-3)] text-[9px] font-bold tracking-wider text-[var(--fg-2)]">BETA</span>
      </span>
    </div>
  )
}
