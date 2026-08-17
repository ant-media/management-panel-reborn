import { type InputHTMLAttributes } from 'react'

// The door pages sit on a photo backdrop, so their cards need real elevation to read as
// surfaces rather than patches. Shared so the login and register cards cannot drift apart.
export const DOOR_CARD = 'p-6 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.65)]'

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'className'> & {
  label: string
  value: string
  onChange: (value: string) => void
}

export function AuthField({ label, value, onChange, ...rest }: AuthFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-3)]">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 px-3 text-[13px] bg-[var(--bg)] border border-[var(--border)] rounded-[6px] outline-none text-[var(--fg)] placeholder:text-[var(--fg-3)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)] transition-shadow"
      />
    </label>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-[6px] px-3 py-2">
      {message}
    </div>
  )
}
