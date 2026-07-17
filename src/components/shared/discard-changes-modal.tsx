import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

// Pairs with useUnsavedGuard. "Keep editing" is the default (focused) action so a
// stray Enter never throws work away.
export function DiscardChangesModal({ open, onDiscard, onCancel, message }: {
  open: boolean
  onDiscard: () => void
  onCancel: () => void
  message?: string
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Discard unsaved changes?"
      width="sm"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onCancel} data-autofocus>Keep editing</Button>
          <Button variant="dangerOutline" size="md" onClick={onDiscard}>Discard changes</Button>
        </>
      }
    >
      <p className="text-[13px] text-[var(--fg-2)] leading-relaxed">
        {message ?? 'You have unsaved changes. Leaving now will discard them.'}
      </p>
    </Modal>
  )
}
