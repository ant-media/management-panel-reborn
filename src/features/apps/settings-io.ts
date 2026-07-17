import { parseJsonText } from '@/lib/json'
import type { AppSettings } from './use-app-settings'

// Import/export of an app's settings as JSON. The settings body travels whole
// (same contract as save: unknown keys ride along), except `appName`, which is
// stripped on both sides so app A's file can never rename app B.

const MARKER = 'app-settings-export'
const VERSION = 1

export type SettingsExport = {
  antmedia: typeof MARKER
  version: number
  app: string
  exportedAt: number
  settings: AppSettings
}

export type SettingsImport = {
  settings: AppSettings
  sourceApp?: string
}

function stripIdentity(settings: AppSettings): AppSettings {
  if (!('appName' in settings)) return settings
  const rest = { ...settings }
  delete rest.appName
  return rest
}

export function serializeSettings(settings: AppSettings, app: string, exportedAt: number): string {
  const payload: SettingsExport = {
    antmedia: MARKER,
    version: VERSION,
    app,
    exportedAt,
    settings: stripIdentity(settings),
  }
  return JSON.stringify(payload, null, 2)
}

// Accepts a version-1 export wrapper or a bare AppSettings object; throws a
// user-facing Error for anything else.
export function parseSettingsImport(text: string): SettingsImport {
  let data: unknown
  try {
    data = parseJsonText(text)
  } catch (e) {
    throw new Error(`Not valid JSON: ${(e as Error).message}`, { cause: e })
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected a JSON object of settings.')

  const obj = data as Partial<SettingsExport>
  if (obj.antmedia === undefined) return { settings: stripIdentity(obj as AppSettings) }

  if (obj.antmedia !== MARKER) throw new Error(`This is a "${String(obj.antmedia)}" file, not an app settings export.`)
  if (obj.version !== VERSION) throw new Error(`Unsupported export version: ${String(obj.version)}.`)
  if (!obj.settings || typeof obj.settings !== 'object' || Array.isArray(obj.settings)) {
    throw new Error('The file has no settings object.')
  }
  return { settings: stripIdentity(obj.settings), sourceApp: typeof obj.app === 'string' ? obj.app : undefined }
}
