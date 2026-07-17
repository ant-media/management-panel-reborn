import { useMemo } from 'react'
import { errorMessage } from '@/lib/api'
import { broadcasts } from '@/lib/api/endpoints'
import type { Broadcast, Result } from './types'

// Single hook collecting every stream mutation so components don't have to
// thread the app through each action. Normalises responses to a Result.
export function useBroadcastActions(appName: string | undefined) {
  return useMemo(() => {
    const api = appName ? broadcasts(appName) : null

    const wrap = async <T>(fn: () => Promise<T>): Promise<Result> => {
      if (!api) return { success: false, message: 'No app selected' }
      try {
        const res = (await fn()) as Result | Broadcast | undefined
        if (res && typeof res === 'object' && 'success' in res) return res as Result
        // CREATE returns the new Broadcast; treat presence of streamId as success.
        if (res && typeof res === 'object' && 'streamId' in res && (res as Broadcast).streamId) {
          return { success: true, id: (res as Broadcast).streamId }
        }
        return { success: true }
      } catch (err) {
        return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
      }
    }

    return {
      create: (input: Partial<Broadcast>, opts?: { autoStart?: boolean }) => wrap(() => api!.create(input, opts)),
      update: (id: string, patch: Partial<Broadcast>) => wrap(() => api!.update(id, patch)),
      remove: (id: string) => wrap(() => api!.remove(id)),
      removeMany: (ids: string[]) => wrap(() => api!.removeMany(ids)),
      start: (id: string) => wrap(() => api!.start(id)),
      stop: (id: string) => wrap(() => api!.stop(id)),
      record: (id: string, enabled: boolean, recordType?: 'mp4' | 'webm') => wrap(() => api!.record(id, enabled, recordType)),
    }
  }, [appName])
}
