import { registerMock } from '@/lib/api'
import type { VoD } from '@/features/vods/types'

// Per-app VoD store, keyed by app name; seeded with a recording, an upload, and a
// user file so the table demos the type variants. Mutations are scoped per app.

type AppName = string
const stores = new Map<AppName, VoD[]>()

const nowMinus = (days: number) => Date.now() - days * 86_400_000
const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`

function seed(app: AppName): VoD[] {
  if (app === 'LiveApp') {
    // Enough rows to paginate the picker at 10/page, with processing/failed rows
    // and a couple of previewFilePath entries in the real wire shape (absolute
    // server path). They 404 in mock, exercising the thumbnail fallback.
    return [
      { vodId: 'rec-lobby-0420', vodName: 'Lobby Camera 2026-04-20', type: 'streamVod', streamId: 'lobby-cam', streamName: 'Lobby Camera', creationDate: nowMinus(3), duration: 5_412_000, fileSize: 1_680_000_000, filePath: 'streams/rec-lobby-0420.mp4', previewFilePath: '/usr/local/antmedia/webapps/LiveApp/previews/rec-lobby-0420.png', processStatus: 'finished' },
      { vodId: 'webinar-intro', vodName: 'Webinar Intro.mp4', type: 'uploadedVod', creationDate: nowMinus(8), duration: 184_000, fileSize: 72_400_000, filePath: 'streams/webinar-intro.mp4', processStatus: 'finished' },
      { vodId: 'promo-loop', vodName: 'Promo Loop', type: 'userVod', creationDate: nowMinus(30), duration: 32_000, fileSize: 14_900_000, filePath: 'streams/promo-loop.mp4' },
      { vodId: 'rec-lobby-0419', vodName: 'Lobby Camera 2026-04-19', type: 'streamVod', streamId: 'lobby-cam', streamName: 'Lobby Camera', creationDate: nowMinus(4), duration: 4_988_000, fileSize: 1_540_000_000, filePath: 'streams/rec-lobby-0419.mp4', previewFilePath: '/usr/local/antmedia/webapps/LiveApp/previews/rec-lobby-0419.png', processStatus: 'finished' },
      { vodId: 'rec-stage-0705', vodName: 'Main Stage 2026-07-05', type: 'streamVod', streamId: 'main-stage', streamName: 'Main Stage', creationDate: nowMinus(6), duration: 7_205_000, fileSize: 2_250_000_000, filePath: 'streams/rec-stage-0705.mp4', processStatus: 'finished' },
      { vodId: 'rec-stage-0704', vodName: 'Main Stage 2026-07-04', type: 'streamVod', streamId: 'main-stage', streamName: 'Main Stage', creationDate: nowMinus(7), duration: 6_444_000, fileSize: 2_010_000_000, filePath: 'streams/rec-stage-0704.mp4', processStatus: 'finished' },
      { vodId: 'product-demo-q3', vodName: 'Product Demo Q3.mp4', type: 'uploadedVod', creationDate: nowMinus(12), duration: 612_000, fileSize: 240_000_000, filePath: 'streams/product-demo-q3.mp4', processStatus: 'finished' },
      { vodId: 'training-onboard', vodName: 'Onboarding Training', type: 'uploadedVod', creationDate: nowMinus(15), duration: 2_710_000, fileSize: 890_000_000, filePath: 'streams/training-onboard.mp4', processStatus: 'finished' },
      { vodId: 'ident-station', vodName: 'Station Ident', type: 'userVod', creationDate: nowMinus(45), duration: 12_000, fileSize: 5_600_000, filePath: 'streams/ident-station.mp4' },
      { vodId: 'archive-keynote', vodName: 'Keynote Archive 2025', type: 'userVod', creationDate: nowMinus(120), duration: 5_940_000, fileSize: 1_820_000_000, filePath: 'streams/archive-keynote.mp4' },
      { vodId: 'upload-4k-cut', vodName: 'Trailer 4K Final Cut.mp4', type: 'uploadedVod', creationDate: nowMinus(1), duration: 0, fileSize: 3_400_000_000, filePath: 'streams/upload-4k-cut.mp4', processStatus: 'processing' },
      { vodId: 'upload-broken', vodName: 'Corrupt Export.mp4', type: 'uploadedVod', creationDate: nowMinus(2), duration: 0, fileSize: 96_000_000, filePath: 'streams/upload-broken.mp4', processStatus: 'failed' },
    ]
  }
  if (app === 'WebRTCAppEE') {
    return [
      { vodId: 'allhands-0601', vodName: 'All-hands 2026-06-01', type: 'streamVod', streamId: 'meeting-001', streamName: 'All-hands', creationDate: nowMinus(9), duration: 3_010_000, fileSize: 905_000_000, filePath: 'streams/allhands-0601.mp4', processStatus: 'finished' },
    ]
  }
  return []
}

function storeOf(app: AppName): VoD[] {
  let s = stores.get(app)
  if (!s) { s = seed(app); stores.set(app, s) }
  return s
}

// ── LIST ────────────────────────────────────────────────────────────
registerMock('GET', '/:app/rest/v2/vods/list/:offset/:size', ({ params, query }) => {
  const search = String(query.search ?? '').toLowerCase()
  const sort = query.sort_by as 'name' | 'date' | undefined
  const order = (query.order_by as 'asc' | 'desc' | undefined) ?? 'asc'

  let filtered = [...storeOf(params.app)]
  if (search) filtered = filtered.filter(v =>
    (v.vodName ?? '').toLowerCase().includes(search) || v.vodId.toLowerCase().includes(search))

  if (sort) {
    filtered.sort((a, b) => sort === 'name'
      ? (a.vodName ?? '').localeCompare(b.vodName ?? '')
      : (a.creationDate ?? 0) - (b.creationDate ?? 0))
    if (order === 'desc') filtered.reverse()
  }

  const offset = Number(params.offset) || 0
  const size = Math.min(Number(params.size) || 50, 50)
  return filtered.slice(offset, offset + size)
})

// ── COUNTS ──────────────────────────────────────────────────────────
registerMock('GET', '/:app/rest/v2/vods/count', ({ params }) => ({ number: storeOf(params.app).length }))
registerMock('GET', '/:app/rest/v2/vods/count/:search', ({ params }) => {
  const q = params.search.toLowerCase()
  return { number: storeOf(params.app).filter(v => (v.vodName ?? '').toLowerCase().includes(q) || v.vodId.toLowerCase().includes(q)).length }
})

// ── UPLOAD (multipart) ──────────────────────────────────────────────
registerMock('POST', '/:app/rest/v2/vods/create', ({ params, query, body }) => {
  const file = body instanceof FormData ? (body.get('file') as File | null) : null
  const vodId = generateId('upload')
  storeOf(params.app).unshift({
    vodId,
    vodName: String(query.name ?? file?.name ?? vodId),
    type: 'uploadedVod',
    creationDate: Date.now(),
    duration: 0,
    fileSize: file?.size ?? 0,
    filePath: `streams/${vodId}.mp4`,
    processStatus: 'finished',
  })
  return { success: true, message: vodId }
})

// ── IMPORT DIRECTORY ────────────────────────────────────────────────
registerMock('POST', '/:app/rest/v2/vods/directory', ({ params, query }) => {
  const dir = String(query.directory ?? '').trim()
  if (!dir) return { success: false, message: 'No directory provided' }
  const vodId = generateId('imported')
  storeOf(params.app).unshift({
    vodId,
    vodName: `${dir.split('/').filter(Boolean).pop() || 'folder'} (imported)`,
    type: 'userVod',
    creationDate: Date.now(),
    duration: 600_000,
    fileSize: 240_000_000,
    filePath: `streams/${vodId}.mp4`,
    processStatus: 'finished',
  })
  return { success: true, message: 'Imported 1 file' }
})

// ── DELETE (single) ─────────────────────────────────────────────────
registerMock('DELETE', '/:app/rest/v2/vods/:id', ({ params }) => {
  const store = storeOf(params.app)
  const idx = store.findIndex(v => v.vodId === params.id)
  if (idx < 0) return { success: false, message: 'Not found' }
  store.splice(idx, 1)
  return { success: true }
})

// ── DELETE (bulk) ───────────────────────────────────────────────────
registerMock('DELETE', '/:app/rest/v2/vods/', ({ params, query }) => {
  const ids = String(query.ids ?? '').split(',').filter(Boolean)
  if (ids.length === 0) return { success: false, message: 'No ids provided' }
  const store = storeOf(params.app)
  const idSet = new Set(ids)
  const before = store.length
  for (let i = store.length - 1; i >= 0; i--) {
    if (idSet.has(store[i].vodId)) store.splice(i, 1)
  }
  return { success: true, message: `Deleted ${before - store.length}` }
})
