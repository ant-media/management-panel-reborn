import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const WIDTH = {
  wide:   'max-w-[1200px]',
  narrow: 'max-w-[768px]',
  full:   '',
} as const

type Props = {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  width?: keyof typeof WIDTH
  children: ReactNode
}

export function Page({ title, subtitle, actions, width = 'wide', children }: Props) {
  return (
    <div className={cn('px-2.5 pt-4 pb-6 mx-auto w-full', WIDTH[width])}>
      {/* The page name already shows in the topbar breadcrumb: omit the visible title to
          avoid showing it twice; keep an sr-only heading for a11y/document structure. */}
      <h1 className="sr-only">{title}</h1>
      {(subtitle || actions) && (
        <header className="flex items-center justify-between gap-4 mb-4">
          <div className="min-w-0 text-[12.5px] text-[var(--fg-3)]">{subtitle}</div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  )
}
