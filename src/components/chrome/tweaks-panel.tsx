import { useEffect, type ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'
import { ACCENTS, useTheme, type AccentKey, type Density, type ThemeMode } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Props = { open: boolean; onClose: () => void }

export function TweaksPanel({ open, onClose }: Props) {
  const t = useTheme()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tweaks-title"
        className="fixed bottom-4 right-4 z-50 w-[280px] max-h-[calc(100vh-32px)] flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[10px] shadow-xl overflow-hidden"
      >
        <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border)]">
          <h2 id="tweaks-title" className="text-[12px] font-semibold tracking-tight text-[var(--fg)]">Tweaks</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tweaks"
            className="w-6 h-6 -mr-1.5 rounded-[6px] text-[var(--fg-3)] hover:text-[var(--fg)] hover:bg-[var(--bg-2)] flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Icon name="x" size={12} />
          </button>
        </header>
        <div className="px-3.5 py-3 flex flex-col gap-3.5 overflow-y-auto">
          <Section label="Theme">
            <Segmented<ThemeMode>
              value={t.theme}
              options={[
                { value: 'light',  label: 'Light' },
                { value: 'dark',   label: 'Dark'  },
                { value: 'system', label: 'Auto'  },
              ]}
              onChange={t.setTheme}
            />
          </Section>

          <Section label="Accent">
            <Swatches value={t.accent} onChange={t.setAccent} />
          </Section>

          <Section label="Density">
            <Segmented<Density>
              value={t.density}
              options={[
                { value: 'regular', label: 'Regular' },
                { value: 'compact', label: 'Compact' },
              ]}
              onChange={t.setDensity}
            />
          </Section>
        </div>
      </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-3)]">{label}</div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" className="flex p-0.5 bg-[var(--bg-2)] rounded-[7px]">
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 px-2 py-1 text-[11.5px] font-medium rounded-[5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              on
                ? 'bg-[var(--card)] text-[var(--fg)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-[var(--fg-3)] hover:text-[var(--fg-2)]',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Swatches({ value, onChange }: { value: AccentKey; onChange: (k: AccentKey) => void }) {
  const keys = Object.keys(ACCENTS) as AccentKey[]
  return (
    <div role="radiogroup" className="flex gap-1.5">
      {keys.map(k => {
        const on = k === value
        const a = ACCENTS[k]
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={a.label}
            title={a.label}
            onClick={() => onChange(k)}
            style={{ background: a.value }}
            className={cn(
              'flex-1 h-7 rounded-[6px] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              on
                ? 'ring-2 ring-offset-2 ring-[var(--fg)] ring-offset-[var(--card)]'
                : 'ring-1 ring-[var(--border-strong)] hover:ring-[var(--fg-3)]',
            )}
          />
        )
      })}
    </div>
  )
}
