import { logs } from '@/lib/api/endpoints'

// The expandability seam. A source = identity + a byte-slice fetcher over the
// system-scoped /log-file endpoint. Cluster per-node logs (Phase 14) drop in as
// extra entries in LOG_SOURCES, the viewer never learns it's reading a cluster.

export interface LogSlice {
  logContent: string
  logContentSize: number
  logFileSize: number
}

export interface LogSource {
  id: string
  label: string
  fileName: string // shown in the header path + used as the download filename
  fetchSlice(offset: number, charSize: number, signal?: AbortSignal): Promise<LogSlice>
}

type RawSlice = Partial<LogSlice>

// Backend caps charSize at 500KB and returns `{ logContent }` only ("There is no log
// yet") when the file is absent; collapse that to an empty slice.
function makeSource(id: string, label: string, fileName: string, logType?: string): LogSource {
  return {
    id, label, fileName,
    async fetchSlice(offset, charSize, signal) {
      const res: RawSlice = await logs.file(offset, charSize, logType, signal)
      const logFileSize = res.logFileSize ?? 0
      if (!logFileSize) return { logContent: '', logContentSize: 0, logFileSize: 0 }
      return { logContent: res.logContent ?? '', logContentSize: res.logContentSize ?? 0, logFileSize }
    },
  }
}

// Stable references: the page picks by id, the tail hook keys its reset on identity.
export const LOG_SOURCES: LogSource[] = [
  makeSource('server', 'Server log', 'ant-media-server.log'),
  makeSource('errors', 'Error log', 'antmedia-error.log', 'error'),
]
