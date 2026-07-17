// Subset of the Java VoD model, only the fields the UI reads. The server keys a
// VoD by `vodId`; everything else is descriptive.

export type VodType = 'streamVod' | 'uploadedVod' | 'userVod'

// Processing pipeline state for uploaded/transcoded files. Stream recordings and
// legacy rows often arrive with no status: treat empty as already playable.
export type VodProcessStatus = '' | 'inqueue' | 'processing' | 'finished' | 'failed'

export type VoD = {
  vodId: string
  vodName?: string
  streamName?: string
  streamId?: string
  type: VodType
  creationDate?: number   // ms epoch
  duration?: number       // ms
  fileSize?: number       // bytes
  filePath?: string       // server-relative, e.g. "streams/<id>.mp4"
  previewFilePath?: string | null // absolute server path; resolve via vodPreviewUrl
  processStatus?: VodProcessStatus
  description?: string
}

const TYPE_LABEL: Record<VodType, string> = {
  streamVod: 'Recording',
  uploadedVod: 'Uploaded',
  userVod: 'User file',
}

export const vodTypeLabel = (t: VodType): string => TYPE_LABEL[t] ?? t
export const vodDisplayName = (v: VoD): string => v.vodName?.trim() || v.vodId

// Playable only once processing finishes; empty status means a legacy/ready file.
export const isVodReady = (v: VoD): boolean => !v.processStatus || v.processStatus === 'finished'
