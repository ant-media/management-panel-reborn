import { ConfirmModal, TargetIds } from '@/components/shared/confirm-modal'
import { DangerCallout } from '@/components/shared/danger-callout'
import { useVodActions } from './use-vod-actions'

// Single + bulk delete share one flow; the copy shifts with the count to avoid awkward grammar.
type Props = {
  appName: string | undefined
  vodIds: string[]   // length >= 1; the parent mounts this only when something is targeted
  onClose: () => void
  onDeleted?: (ids: string[]) => void
}

export function ConfirmDeleteVodsModal({ appName, vodIds, onClose, onDeleted }: Props) {
  const actions = useVodActions(appName)
  const count = vodIds.length
  const single = count === 1

  return (
    <ConfirmModal
      title={single ? 'Delete VoD' : `Delete ${count} VoDs`}
      confirmLabel={single ? 'Delete' : `Delete ${count}`}
      busyLabel="Deleting…"
      errorFallback="Could not delete. The server gave no reason. Check the server logs, and that the file is not being written to."
      onConfirm={() => single ? actions.remove(vodIds[0]) : actions.removeMany(vodIds)}
      onDone={() => onDeleted?.(vodIds)}
      onClose={onClose}
    >
      <DangerCallout icon="trash">
        {single
          ? <>This video file will be <span className="font-semibold text-[var(--danger)]">permanently deleted</span> from the server. This can’t be undone.</>
          : <><span className="font-semibold text-[var(--danger)]">{count} video files</span> will be <span className="font-semibold text-[var(--danger)]">permanently deleted</span> from the server. This can’t be undone.</>}
      </DangerCallout>
      <TargetIds label="VoD ID" ids={vodIds} />
    </ConfirmModal>
  )
}
