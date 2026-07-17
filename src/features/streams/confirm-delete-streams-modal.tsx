import { ConfirmModal, TargetIds } from '@/components/shared/confirm-modal'
import { DangerCallout } from '@/components/shared/danger-callout'
import { useBroadcastActions } from './use-broadcast-actions'

// Single + bulk delete share one flow; the copy shifts with the count to avoid awkward grammar.
type Props = {
  appName: string | undefined
  streamIds: string[]   // length >= 1; the parent mounts this only when something is targeted
  onClose: () => void
  onDeleted?: (ids: string[]) => void
}

export function ConfirmDeleteStreamsModal({ appName, streamIds, onClose, onDeleted }: Props) {
  const actions = useBroadcastActions(appName)
  const count = streamIds.length
  const single = count === 1

  return (
    <ConfirmModal
      title={single ? 'Delete stream' : `Delete ${count} streams`}
      confirmLabel={single ? 'Delete' : `Delete ${count}`}
      busyLabel="Deleting…"
      errorFallback="Could not delete. The server gave no reason. Check the server logs."
      onConfirm={() => single ? actions.remove(streamIds[0]) : actions.removeMany(streamIds)}
      onDone={() => onDeleted?.(streamIds)}
      onClose={onClose}
    >
      <DangerCallout icon="trash">
        {single
          ? <>This stream and its on-disk recordings will be <span className="font-semibold text-[var(--danger)]">permanently deleted</span>. Any active broadcast stops and viewers disconnect. This can’t be undone.</>
          : <><span className="font-semibold text-[var(--danger)]">{count} streams</span> and their recordings will be <span className="font-semibold text-[var(--danger)]">permanently deleted</span>. Active broadcasts stop and viewers disconnect. This can’t be undone.</>}
      </DangerCallout>
      <TargetIds label="Stream ID" ids={streamIds} />
    </ConfirmModal>
  )
}
