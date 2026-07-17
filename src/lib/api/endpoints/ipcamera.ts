import { appApi } from '../client'
import type { Query } from '../transport'
import type { Result } from '../types'

type Move = { valueX?: number; valueY?: number; valueZ?: number; movement?: 'absolute' | 'relative' | 'continuous' }

// IP camera control (ONVIF discovery + PTZ), under `/v2/broadcasts`.
export function ipcamera(app: string) {
  const c = appApi(app)
  const id = (v: string) => encodeURIComponent(v)
  return {
    onvifDevices: (signal?: AbortSignal) => c.get<string[]>('/broadcasts/onvif-devices', { signal }),
    deviceProfiles: (streamId: string, signal?: AbortSignal) =>
      c.get<string[]>(`/broadcasts/${id(streamId)}/ip-camera/device-profiles`, { signal }),
    move: (streamId: string, m: Move) =>
      c.post<Result>(`/broadcasts/${id(streamId)}/ip-camera/move`, undefined, { query: m as Query }),
    stopMove: (streamId: string) =>
      c.post<Result>(`/broadcasts/${id(streamId)}/ip-camera/stop-move`),
    error: (streamId: string, signal?: AbortSignal) =>
      c.get<Result>(`/broadcasts/${id(streamId)}/ip-camera-error`, { signal }),
  }
}
