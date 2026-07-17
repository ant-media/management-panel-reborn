import type { AppSettings } from '@/features/apps/use-app-settings'
import { PlayerFrame } from './player-frame'
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
  return (
    <PlayerFrame
      title={displayName(broadcast)}
      subtitle={broadcast.name?.trim() ? <span className="font-mono">{broadcast.streamId}</span> : undefined}
      url={url}
      loading={loading}
      error={error}
      onClose={onClose}
    />
  )
}
