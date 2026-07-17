import { useCallback, useEffect, useState } from 'react'

// Transient status line for a tab/page. Pair with <ToastBanner> from
// components/shared/toast. One toast at a time; a new flash() replaces the last.
export type Toast = { kind: 'ok' | 'err'; message: string }

const TOAST_MS = 8000

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)

  // Auto-dismiss; the cleanup also covers unmount and back-to-back flashes.
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(id)
  }, [toast])

  // Last-resort net: a blank message would render an empty banner with nothing but an icon.
  // Call sites are meant to pass a fallback (`resultError`/`errorMessage`); this catches the ones
  // that forget.
  const flash = useCallback((kind: Toast['kind'], message: string) =>
    setToast({ kind, message: message.trim() || (kind === 'err' ? 'Something went wrong. Check the server logs.' : 'Done.') }), [])
  const dismiss = useCallback(() => setToast(null), [])

  return { toast, flash, dismiss }
}
