import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { CodeChip } from '@/components/shared/code-chip'
import { FormError } from '@/components/shared/form'
import type { IconName } from '@/components/ui/icon'
import { resultError, type Result } from '@/lib/api'

// Every "are you sure?" dialog in the panel. It owns the busy/error state machine and the footer,
// so a call site is only its copy. Pair with `DangerCallout` for the warning and `TargetIds` below.
//
// MOUNT = OPEN: render it conditionally (`{target && <ConfirmModal …>}`) so each open starts fresh.
// No reset-on-open effect to forget, and `Modal` has no exit animation to preserve.
//
// A failed action keeps the dialog open and shows the message inline. Never close on failure: the
// user loses both the error and the chance to retry.

type Props = {
  title: string
  icon?: IconName
  confirmLabel: string
  busyLabel: string
  errorFallback: string
  // Gate the confirm button (e.g. "type the app name to confirm").
  canConfirm?: boolean
  // Confirm is focused by default. Move it when the body owns a field, or when the action is
  // destructive enough that Cancel is the safer landing spot.
  autoFocus?: 'confirm' | 'cancel' | 'body'
  onConfirm: () => Promise<Result>
  onClose: () => void
  onDone?: () => void
  children: ReactNode
}

export function ConfirmModal({
  title, icon, confirmLabel, busyLabel, errorFallback, canConfirm = true, autoFocus = 'confirm',
  onConfirm, onClose, onDone, children,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (busy || !canConfirm) return
    setBusy(true); setError(null)
    const res = await onConfirm()
    setBusy(false)
    if (res.success) { onDone?.(); onClose() }
    else setError(resultError(res, errorFallback))
  }

  const focus = (target: Props['autoFocus']) =>
    !busy && autoFocus === target ? { 'data-autofocus': true } : {}

  return (
    <Modal open onClose={onClose} dismissible={!busy} title={title} icon={icon} width="sm"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy} {...focus('cancel')}>Cancel</Button>
          <Button variant="dangerOutline" size="md" onClick={submit} disabled={busy || !canConfirm} {...focus('confirm')}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {/* A form so Enter submits from a field in the body; Button defaults to type="button", so
          nothing else in here can submit by accident. */}
      <form onSubmit={e => { e.preventDefault(); void submit() }} className="flex flex-col gap-3.5">
        {children}
        {error && <FormError>{error}</FormError>}
      </form>
    </Modal>
  )
}

// What the action targets: one id inline, or a collapsed scrollable list for a bulk action.
export function TargetIds({ label, ids }: { label: string; ids: string[] }) {
  if (ids.length === 1) {
    return <div className="text-[12.5px] text-[var(--fg-2)]">{label} <CodeChip className="ml-1">{ids[0]}</CodeChip></div>
  }
  return (
    <details className="rounded-[6px] border border-[var(--border-strong)] px-3 py-2">
      <summary className="cursor-pointer select-none text-[12.5px] text-[var(--fg-2)]">{ids.length} {label}s</summary>
      <div className="mt-2 max-h-[160px] overflow-auto flex flex-col items-start gap-1">
        {ids.map(id => <CodeChip key={id}>{id}</CodeChip>)}
      </div>
    </details>
  )
}
