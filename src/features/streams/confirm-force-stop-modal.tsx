import { ConfirmModal, TargetIds } from '@/components/shared/confirm-modal'
import { DangerCallout } from '@/components/shared/danger-callout'
import { useBroadcastActions } from './use-broadcast-actions'
import { displayName, type Broadcast } from './types'

// Force-stopping disconnects a live publisher mid-broadcast, so it always confirms, unlike
// Start/Stop of a server-pulled source, which fires straight from the row.
type Props = {
  appName: string
  broadcast: Broadcast
  onClose: () => void
  onStopped: (b: Broadcast) => void
}

export function ConfirmForceStopModal({ appName, broadcast, onClose, onStopped }: Props) {
  const actions = useBroadcastActions(appName)

  return (
    <ConfirmModal
      title="Force stop ingest"
      icon="power"
      confirmLabel="Force Stop"
      busyLabel="Stopping…"
      errorFallback="Could not stop the ingest. The server gave no reason. It may have already disconnected; refresh to check."
      onConfirm={() => actions.stop(broadcast.streamId)}
      onDone={() => onStopped(broadcast)}
      onClose={onClose}
    >
      <DangerCallout icon="power">
        The publisher of <span className="font-semibold text-[var(--danger)]">{displayName(broadcast)}</span> is{' '}
        <span className="font-semibold text-[var(--danger)]">disconnected immediately</span> and the broadcast ends
        for everyone watching. Nothing is deleted, and the publisher can reconnect.
      </DangerCallout>
      <TargetIds label="Stream ID" ids={[broadcast.streamId]} />
    </ConfirmModal>
  )
}
