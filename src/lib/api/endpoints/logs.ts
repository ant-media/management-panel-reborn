import { api } from '../client'

// 'error' = error log, anything else = server log. Always send a logType: older servers
// NPE on a null logType (CommonRestService.getLogFile), so default it to 'server'.
export const logs = {
  file: (offset: number, charSize: number, logType?: string, signal?: AbortSignal) =>
    api.get<{ logContent?: string; logContentSize?: number; logFileSize?: number }>(
      `/log-file/${offset}/${charSize}`, { query: { logType: logType ?? 'server' }, signal },
    ),
}
