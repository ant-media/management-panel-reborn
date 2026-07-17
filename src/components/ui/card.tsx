import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-[var(--card)] border border-[var(--border)] rounded-[10px]', className)} {...rest} />
}
