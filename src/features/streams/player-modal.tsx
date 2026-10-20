import { useCallback } from 'react'
import type { AppSettings } from '@/features/apps/use-app-settings'
import { useToast } from '@/lib/use-toast'
import { PlayerFrame } from './player-frame'
import { enablePtz } from './ptz'
import { displayName, type Broadcast } from './types'
import { usePlayUrl } from './use-play-url'

type Props = {
  appName: string
  broadcast: Broadcast
  settings: AppSettings | null
  onClose: () => void
}

export function PlayerModal({ appName, broadcast, settings, onClose }: Props) {
  const { url, loading, error } = usePlayUrl(appName, broadcast, settings)
  const { toast, flash, dismiss } = useToast()
  const { streamId } = broadcast
  const ptz = useCallback(
    (win: Window) => enablePtz(win, appName, streamId, err => (err ? flash('err', err) : dismiss())),
    [appName, streamId, flash, dismiss],
  )
  return (
    <PlayerFrame
      title={displayName(broadcast)}
      subtitle={broadcast.name?.trim() ? <span className="font-mono">{broadcast.streamId}</span> : undefined}
      url={url}
      loading={loading}
      error={error}
      onClose={onClose}
      onPlayerLoad={broadcast.type === 'ipCamera' ? ptz : undefined}
      notice={toast && { message: toast.message, onDismiss: dismiss }}
    />
  )
}
