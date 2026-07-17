import { useCallback, useMemo } from 'react'
import { useApi } from '@/lib/api'
import { broadcasts, type BroadcastStatistics, type StreamMetricsHistory, type WebRTCClientStat } from '@/lib/api/endpoints'
import { useAppSettings, type AppSettings } from '@/features/apps/use-app-settings'
import { isLive, type Broadcast } from './types'

const POLL_MS = 2_000
// Server samples per stream every ~10s, so polling the ring faster only adds noise.
const HISTORY_POLL_MS = 5_000
const WEBRTC_PAGE = 50

const EMPTY_HISTORY: StreamMetricsHistory = {
  bitrate: [], viewers: [], speed: [], encoderQueueSize: [], droppedPackets: [], droppedFrames: [], packetLostRatio: [],
}

export type ViewerBreakdown = { webrtc: number; hls: number; dash: number; total: number }

export type StreamDetailData = {
  broadcast: Broadcast | null
  viewers: ViewerBreakdown | null
  webrtcClients: WebRTCClientStat[] | null
  // false ⇒ the app has writeStatsToDatastore off, so WebRTC/HLS/DASH counts read 0.
  viewerStatsEnabled: boolean
  // The app's settings POJO (recording defaults, encoders), shared so the drawer
  // doesn't re-fetch what this hook already needs for viewerStatsEnabled.
  settings: AppSettings | null
  // Server-side ring (oldest → newest); pre-populated on open, survives close/reopen.
  // Falls back to empty when collecting or unsupported, so charts degrade to "collecting" not crash.
  history: StreamMetricsHistory
  error: Error | null
  isLoading: boolean
  refresh: () => void
}

// The stats endpoint returns -1 for a protocol with no active scope; clamp so it reads 0.
const sumViewers = (s: BroadcastStatistics): ViewerBreakdown => {
  const webrtc = Math.max(0, s.totalWebRTCWatchersCount ?? 0)
  const hls = Math.max(0, s.totalHLSWatchersCount ?? 0)
  const dash = Math.max(0, s.totalDASHWatchersCount ?? 0)
  return { webrtc, hls, dash, total: webrtc + hls + dash }
}

export function useStreamDetail(appName: string, streamId: string): StreamDetailData {
  const api = useMemo(() => broadcasts(appName), [appName])
  const idKey = `${appName}|${streamId}`

  const detail = useApi<Broadcast>(
    signal => api.get(streamId, signal),
    { pollMs: POLL_MS, refetchKey: idKey },
  )

  const stats = useApi<BroadcastStatistics>(
    signal => api.statistics(streamId, signal),
    { pollMs: POLL_MS, refetchKey: idKey },
  )

  // WebRTC player stats and the metric ring only exist while live, skip both polls otherwise.
  const live = isLive(detail.data?.status)
  const webrtc = useApi<WebRTCClientStat[]>(
    signal => api.webrtcClientStats(streamId, 0, WEBRTC_PAGE, signal),
    { pollMs: POLL_MS, enabled: live, refetchKey: idKey },
  )

  const history = useApi<StreamMetricsHistory>(
    signal => api.metricsHistory(streamId, signal),
    { pollMs: HISTORY_POLL_MS, enabled: live, refetchKey: idKey },
  )

  const viewers = useMemo(() => (stats.data ? sumViewers(stats.data) : null), [stats.data])

  // One settings fetch serves both the stats-disabled gate and the drawer's recording
  // controls. Optimistic: viewer stats read enabled until the flag is known.
  const { data: settings } = useAppSettings(appName)
  const viewerStatsEnabled = settings?.writeStatsToDatastore !== false

  const dRefresh = detail.refresh
  const sRefresh = stats.refresh
  const wRefresh = webrtc.refresh
  const hRefresh = history.refresh
  const refresh = useCallback(() => { dRefresh(); sRefresh(); wRefresh(); hRefresh() }, [dRefresh, sRefresh, wRefresh, hRefresh])

  return {
    broadcast: detail.data,
    viewers,
    webrtcClients: webrtc.data,
    viewerStatsEnabled,
    settings: settings ?? null,
    history: history.data ?? EMPTY_HISTORY,
    // A missing metrics-history endpoint must not blank the drawer, keep it out of the top-level error.
    error: detail.error ?? stats.error,
    isLoading: detail.isLoading,
    refresh,
  }
}
