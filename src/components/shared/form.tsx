import { useId, type ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

// Shared form bits for in-app dialog modals. (The auth pages keep their own in
// features/auth/form.tsx, a deliberately distinct full-page treatment.)

// Shared label + hint/error wrapper: Field and SelectField both render it.
function FieldShell({ id, label, required, optional, error, hint, children }: {
  id: string; label: ReactNode; required?: boolean; optional?: boolean
  error?: ReactNode; hint?: ReactNode; children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-medium text-[var(--fg)] mb-1.5">
        {label}
        {required && <span className="text-[var(--danger)]"> *</span>}
        {optional && <span className="font-normal text-[var(--fg-3)]"> (optional)</span>}
      </label>
      {children}
      {error
        ? <div className="mt-1.5 text-[11.5px] text-[var(--danger)]">{error}</div>
        : hint ? <div className="mt-1.5 text-[11px] text-[var(--fg-3)]">{hint}</div> : null}
    </div>
  )
}

const INPUT_CLS = 'w-full h-9 px-3 text-[13px] bg-[var(--bg-2)] border border-[var(--border)] rounded-[6px] outline-none text-[var(--fg)] placeholder:text-[var(--fg-3)] transition-colors disabled:opacity-50'

type FieldProps = {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode            // replaces the hint while present
  optional?: boolean
  required?: boolean
  mono?: boolean
  tone?: 'default' | 'danger'  // danger = focus ring in --danger (destructive confirms)
  type?: 'text' | 'password'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean          // wires the modal's [data-autofocus] contract
  autoComplete?: string
  maxLength?: number
}

export function Field({
  label, hint, error, optional, required, mono, tone = 'default', type = 'text',
  value, onChange, placeholder, disabled, autoFocus, autoComplete, maxLength,
}: FieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} optional={optional} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        {...(autoFocus ? { 'data-autofocus': true } : {})}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className={cn(INPUT_CLS,
          tone === 'danger' ? 'focus:border-[var(--danger-border)]' : 'focus:border-[var(--accent)]',
          mono && 'font-mono')}
      />
    </FieldShell>
  )
}

type SelectFieldProps = {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  value: string
  onChange: (value: string) => void
  options: [value: string, label: string][]
  disabled?: boolean
  autoFocus?: boolean
}

export function SelectField({ label, hint, error, required, value, onChange, options, disabled, autoFocus }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <select
        id={id}
        {...(autoFocus ? { 'data-autofocus': true } : {})}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={cn(INPUT_CLS, 'focus:border-[var(--accent)] cursor-pointer')}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </FieldShell>
  )
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 text-[12.5px] text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-[6px] px-3 py-2">
      <Icon name="info" size={13} className="shrink-0 mt-px" />
      <span className="leading-snug">{children}</span>
    </div>
  )
}
