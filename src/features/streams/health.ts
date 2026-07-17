import type { Broadcast } from './types'

// Single source of truth for a stream's display status. Both the streams table
// and the detail drawer render off this, so the badge + hover diagnostics stay
// identical everywhere.
//
// The backend computes no health verdict; it only persists raw quality metrics
// on the Broadcast record. We judge health here, reusing the exact thresholds
// the legacy Angular console shipped (getStreamHealthColor / getStreamDiagnose)
// so operators see the behaviour they already know.

export type StreamStatusKind = 'healthy' | 'unhealthy' | 'preparing' | 'offline' | 'error'

export type StreamStatusInfo = {
  kind: StreamStatusKind
  // Lines for the hover popup. Populated for 'unhealthy' (the failing quality
  // checks) and 'error' (what went wrong); empty for the calm states.
  reasons: string[]
}

// Ingest-quality checks. A broadcasting stream is "unhealthy" if ANY trips.
// Caveats from the backend: rtt/jitter/packetLost are WebRTC-only (0 for
// RTMP/SRT/RTSP, so they never false-trip there), and `speed` is meaningless
// for WebRTC ingest, hence the `speed > 0` guard, which also keeps a
// just-started stream (speed 0) out of the warning.
const HEALTH_CHECKS: { trips: (b: Broadcast) => boolean; reason: (b: Broadcast) => string }[] = [
  {
    trips: b => (b.speed ?? 0) > 0 && (b.speed ?? 0) < 0.7,
    reason: b => `Encoding is falling behind realtime: ${(b.speed ?? 0).toFixed(2)}x (publisher network or server load)`,
  },
  {
    trips: b => (b.packetLostRatio ?? 0) > 0.02,
    reason: b => `High packet loss: ${((b.packetLostRatio ?? 0) * 100).toFixed(1)}% (publisher network)`,
  },
  {
    trips: b => (b.rttMs ?? 0) > 100,
    reason: b => `High round-trip time: ${b.rttMs}ms (publisher network latency)`,
  },
  {
    trips: b => (b.jitterMs ?? 0) > 50,
    reason: b => `High jitter: ${b.jitterMs}ms (unstable publisher network)`,
  },
  {
    trips: b => (b.pendingPacketSize ?? 0) > 15,
    reason: b => `Input queue backing up: ${b.pendingPacketSize} packets (server overloaded)`,
  },
  {
    trips: b => (b.encoderQueueSize ?? 0) > 15,
    reason: b => `Encoder queue backing up: ${b.encoderQueueSize} frames (CPU/GPU overloaded)`,
  },
]

const ERROR_REASON: Partial<Record<Broadcast['status'], string>> = {
  error: 'The stream encountered an error.',
  failed: 'The stream failed to start.',
  terminated_unexpectedly: 'The stream stopped unexpectedly, no data received for ~20s.',
}

export function resolveStreamStatus(b: Broadcast): StreamStatusInfo {
  switch (b.status) {
    case 'broadcasting': {
      const reasons = HEALTH_CHECKS.filter(c => c.trips(b)).map(c => c.reason(b))
      return reasons.length ? { kind: 'unhealthy', reasons } : { kind: 'healthy', reasons: [] }
    }
    case 'preparing':
      return { kind: 'preparing', reasons: [] }
    case 'error':
    case 'failed':
    case 'terminated_unexpectedly':
      return { kind: 'error', reasons: [ERROR_REASON[b.status] ?? 'The stream is in an error state.'] }
    default: // created, finished, anything unknown
      return { kind: 'offline', reasons: [] }
  }
}
