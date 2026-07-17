import { useMemo } from 'react'
import { vods } from '@/lib/api/endpoints'
import { errorMessage, type Result } from '@/lib/api'

// Every VoD mutation in one hook so components don't thread the app through each
// call. Normalises responses to a Result.
export function useVodActions(appName: string | undefined) {
  return useMemo(() => {
    const api = appName ? vods(appName) : null

    const wrap = async (fn: () => Promise<unknown>): Promise<Result> => {
      if (!api) return { success: false, message: 'No app selected' }
      try {
        const res = await fn()
        if (res && typeof res === 'object' && 'success' in res) return res as Result
        return { success: true }
      } catch (err) {
        return { success: false, message: errorMessage(err, 'The request failed. Check that the server is reachable.') }
      }
    }

    return {
      remove: (id: string) => wrap(() => api!.remove(id)),
      removeMany: (ids: string[]) => wrap(() => api!.removeMany(ids)),
      upload: (file: File, name?: string) => wrap(() => api!.upload(file, name)),
      importDirectory: (directory: string) => wrap(() => api!.importDirectory(directory)),
    }
  }, [appName])
}
