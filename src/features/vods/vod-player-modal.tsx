import type { AppSettings } from '@/features/apps/use-app-settings'
import { PlayerFrame } from '@/features/streams/player-frame'
import { vodDisplayName, type VoD } from './types'
import { useVodPlayUrl } from './use-vod-play-url'

type Props = {
  appName: string
  vod: VoD
  settings: AppSettings | null
  onClose: () => void
}

export function VodPlayerModal({ appName, vod, settings, onClose }: Props) {
  const { url, loading, error } = useVodPlayUrl(appName, vod, settings)
  return (
    <PlayerFrame
      title={vodDisplayName(vod)}
      subtitle={vod.vodName?.trim() ? <span className="font-mono">{vod.vodId}</span> : undefined}
      url={url}
      loading={loading}
      error={error}
      onClose={onClose}
    />
  )
}
