import { parseJsonText } from '@/lib/json'
import type { Broadcast } from './types'

// Import/export of stream definitions as JSON. Export is an allow-list of the
// fields that actually define a stream. Everything else on a Broadcast is
// runtime state (viewer counts, bitrate, status, timestamps) the server
// recomputes. Keeping this an allow-list, not a runtime blacklist, means a new
// backend field can never silently leak into an export or an import payload.

const EXPORT_FIELDS = [
  'streamId', 'name', 'description', 'type', 'streamUrl', 'ipAddr', 'username',
  'password', 'playListItemList', 'playlistLoopEnabled', 'autoStartStopEnabled',
  'mp4Enabled', 'webMEnabled', 'endPointList', 'publicStream', 'listenerHookURL',
] as const satisfies readonly (keyof Broadcast)[]

const MARKER = 'streams-export'
const VERSION = 1

export type StreamsExport = {
  antmedia: typeof MARKER
  version: number
  app: string
  exportedAt: number
  streams: Partial<Broadcast>[]
}

function pickDefinition(source: Partial<Broadcast> | null | undefined): Partial<Broadcast> {
  const out: Partial<Broadcast> = {}
  if (!source || typeof source !== 'object') return out
  for (const key of EXPORT_FIELDS) {
    const v = source[key]
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[key] = v
  }
  return out
}

export function serializeStreams(streams: Broadcast[], app: string, exportedAt: number): string {
  const payload: StreamsExport = {
    antmedia: MARKER,
    version: VERSION,
    app,
    exportedAt,
    streams: streams.map(pickDefinition),
  }
  return JSON.stringify(payload, null, 2)
}

// Throws a user-facing Error on anything that isn't a version-1 export file.
export function parseImport(text: string): Partial<Broadcast>[] {
  let data: unknown
  try {
    data = parseJsonText(text)
  } catch (e) {
    throw new Error(`Not valid JSON: ${(e as Error).message}`, { cause: e })
  }
  if (!data || typeof data !== 'object') throw new Error('Unrecognised file format.')

  const obj = data as Partial<StreamsExport>
  if (obj.antmedia !== MARKER) {
    throw new Error(obj.antmedia === undefined
      ? 'This is not a streams export file.'
      : `This is a "${String(obj.antmedia)}" file, not a streams export.`)
  }
  if (obj.version !== VERSION) throw new Error(`Unsupported export version: ${String(obj.version)}.`)
  if (!Array.isArray(obj.streams)) throw new Error('The file has no streams list.')

  // Re-pick to the allow-list so hand-edited junk never reaches the create call.
  return obj.streams.map(pickDefinition)
}
