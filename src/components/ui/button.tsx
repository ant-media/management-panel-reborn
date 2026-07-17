import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const BASE = 'inline-flex items-center justify-center gap-1.5 font-medium transition-colors rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap'

const VARIANT = {
  primary: 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90',
  outline: 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]',
  ghost:   'text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]',
  dangerOutline: 'border border-[var(--danger-border)] text-[var(--danger)] hover:bg-[var(--danger-bg)]',
} as const

const SIZE = {
  sm:     'h-7 px-2.5 text-[12px]',
  md:     'h-8 px-3 text-[12.5px]',
  icon:   'h-8 w-8',
  iconSm: 'h-6 w-6',
} as const

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT
  size?: keyof typeof SIZE
}

export function Button({ variant = 'outline', size = 'sm', type = 'button', className, ...rest }: Props) {
  return <button type={type} className={cn(BASE, VARIANT[variant], SIZE[size], className)} {...rest} />
}
