import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { DangerCallout } from '@/components/shared/danger-callout'
import { CodeChip } from '@/components/shared/code-chip'
import { Field } from '@/components/shared/form'
import { useApplications } from './use-applications'

// Deleting an app takes the whole scope with it, so it is the one confirm gated on typing the name.
type Props = {
  appName: string
  onClose: () => void
  onDeleted?: (name: string) => void
}

export function ConfirmDeleteModal({ appName, onClose, onDeleted }: Props) {
  const { remove } = useApplications()
  const [confirmName, setConfirmName] = useState('')
  const [deleteDB, setDeleteDB] = useState(true)

  return (
    <ConfirmModal
      title="Delete application"
      confirmLabel="Delete"
      busyLabel="Deleting…"
      errorFallback="Could not delete the application. The server gave no reason. Check the server logs."
      canConfirm={confirmName.trim() === appName}
      autoFocus="body"
      onConfirm={() => remove(appName, deleteDB)}
      onDone={() => onDeleted?.(appName)}
      onClose={onClose}
    >
      <DangerCallout icon="trash">
        This <span className="font-semibold text-[var(--danger)]">permanently deletes</span> the application and its scope from the server. Active streams stop and viewers disconnect. This can’t be undone.
      </DangerCallout>
      <Field
        label={<>Type <CodeChip>{appName}</CodeChip> to confirm</>}
        tone="danger"
        mono
        autoFocus
        autoComplete="off"
        value={confirmName}
        onChange={setConfirmName}
      />
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <Checkbox checked={deleteDB} onChange={setDeleteDB} />
        <span className="text-[12.5px] text-[var(--fg-2)]">Also delete the application database</span>
      </label>
    </ConfirmModal>
  )
}
