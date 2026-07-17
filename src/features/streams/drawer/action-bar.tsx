import { Icon, type IconName } from '@/components/ui/icon'
import { Tooltip } from '@/components/shared/tooltip'
import { cn } from '@/lib/utils'
import { STREAM_ACTIONS, streamAction, type StreamAction } from '../stream-actions'
import { isEditable, isLive, type Broadcast } from '../types'

// The drawer's primary actions, as tappable tiles above the metric tiles (same radius, border and
// gap, so the two rows read as one system). An action that doesn't apply to this stream stays in
// place, greyed, with a tooltip saying why: the grid never reflows and the rule is discoverable.

type Props = {
  broadcast: Broadcast
  busy: boolean
  onPlay: () => void
  onAction: (action: StreamAction) => void
  onEdit: () => void
  onDelete: () => void
}

export function StreamActionBar({ broadcast, busy, onPlay, onAction, onEdit, onDelete }: Props) {
  const live = isLive(broadcast.status)
  const editable = isEditable(broadcast)
  const action = streamAction(broadcast)

  // No action ⇒ the stream can't be started from the server: a publisher pushes to us, and a VoD
  // record isn't an ingest at all. Fall back to a dead Start tile that says why, rather than a
  // button that silently does nothing.
  const { icon, short, tint } = STREAM_ACTIONS[action ?? 'start']
  const actionReason = action === 'forceStop' ? 'Disconnects the publisher immediately'
    : action ? undefined
    : broadcast.type === 'liveStream' ? 'A publisher stream starts when the publisher connects'
    : 'This stream type cannot be started from the panel'

  return (
    <div className="px-5 pt-4 grid grid-cols-4 gap-2">
      <ActionTile
        icon="play" label="Play" tint="text-[var(--ok)]"
        disabled={!live} reason={live ? undefined : 'Stream is offline'}
        onClick={onPlay}
      />
      <ActionTile
        icon={icon} label={short} tint={tint}
        disabled={!action || busy} reason={actionReason}
        onClick={() => action && onAction(action)}
      />
      <ActionTile
        icon="edit" label="Edit"
        disabled={!editable} reason={editable ? undefined : 'VoD entries have nothing to edit'}
        onClick={onEdit}
      />
      <ActionTile icon="trash" label="Delete" tint="text-[var(--danger)]" onClick={onDelete} />
    </div>
  )
}

function ActionTile({ icon, label, tint, disabled = false, reason, onClick }: {
  icon: IconName
  label: string
  tint?: string
  disabled?: boolean
  reason?: string
  onClick: () => void
}) {
  // A disabled button can't take focus, so the wrapper must, or the reason is keyboard-invisible.
  return (
    <Tooltip content={reason} delay={0} focusable={disabled}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'w-full flex flex-col items-center justify-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--bg-2)] px-2 py-3 transition-all',
          disabled
            ? 'opacity-40'
            : 'hover:border-[var(--border-strong)] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        )}
      >
        <Icon name={icon} size={17} className={disabled ? 'text-[var(--fg-3)]' : (tint ?? 'text-[var(--fg-2)]')} />
        <span className="text-[11px] leading-none text-[var(--fg-2)] truncate max-w-full">{label}</span>
      </button>
    </Tooltip>
  )
}
