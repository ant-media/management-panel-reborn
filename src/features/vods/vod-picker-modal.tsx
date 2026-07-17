import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Icon } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { Pagination } from '@/components/shared/pagination'
import { Pill } from '@/components/shared/pill'
import { SearchInput } from '@/components/shared/search-input'
import { fmtDuration } from '@/lib/format'
import type { PageSize } from '@/lib/page-size'
import { useRangeSelection } from '@/lib/use-range-selection'
import { cn } from '@/lib/utils'
import { isVodReady, vodDisplayName, vodTypeLabel, type VoD } from './types'
import { useVods } from './use-vods'
import { vodPreviewUrl } from './url-builder'

// Multi-select browser over an app's VoD library. The parent mounts it only while
// open (all local state resets by unmount) and receives the picked VoDs on confirm,
// in the order they were selected.

type Props = {
  appName: string
  onAdd: (vods: VoD[]) => Promise<void>
  onClose: () => void
}

export function VodPickerModal({ appName, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [pageSize, setPageSize] = useState<PageSize>(10)
  const [busy, setBusy] = useState(false)

  const { vods, total, error, isLoading, refresh } = useVods(appName, {
    offset, pageSize, search, sortKey: 'date', sortDir: 'desc',
  })

  const rows = vods ?? []
  const readyIds = rows.filter(isVodReady).map(v => v.vodId)
  const { selected, select, toggleAll } = useRangeSelection(readyIds)
  const allSelected = readyIds.length > 0 && readyIds.every(id => selected.has(id))

  // Selection survives paging, so remember every row ever rendered to map the
  // selected ids (Set insertion order = pick order) back to VoDs on confirm.
  const seen = useRef(new Map<string, VoD>())
  useEffect(() => { for (const v of rows) seen.current.set(v.vodId, v) })

  const updateSearch = (v: string) => { setSearch(v); setOffset(0) }

  const confirm = async () => {
    const picked = [...selected].map(id => seen.current.get(id)).filter((v): v is VoD => Boolean(v))
    if (picked.length === 0 || busy) return
    setBusy(true)
    try { await onAdd(picked) } finally { setBusy(false) }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      width="lg"
      title="Pick VoDs"
      icon="video"
      description={`Insert videos from ${appName} into the playlist`}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" onClick={() => void confirm()} disabled={busy || selected.size === 0}>
            {busy ? 'Adding…' : selected.size > 0 ? `Add ${selected.size} item${selected.size > 1 ? 's' : ''}` : 'Add items'}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3 pb-3">
        <SearchInput
          value={search}
          onChange={updateSearch}
          placeholder="Search by name or ID…"
          ariaLabel="Search VoDs"
          autoFocus
          className="flex-1"
        />
        <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--fg-3)] select-none">
          <Checkbox checked={allSelected} onChange={toggleAll} />
          <span>Select page</span>
        </div>
      </div>

      {error && <LoadErrorBanner entity="VoDs" error={error} onRetry={refresh} className="mb-3" />}

      <div className="h-[380px] overflow-y-auto border border-[var(--border)] rounded-[7px]">
        {rows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-8">
            {isLoading && vods == null ? (
              <div className="text-[12px] text-[var(--fg-3)]">Loading VoDs…</div>
            ) : error && vods == null ? (
              <div className="text-[12px] text-[var(--fg-3)]">Could not load VoDs.</div>
            ) : search ? (
              <div className="text-[12px] text-[var(--fg-3)]">No matches for "{search}"</div>
            ) : (
              <>
                <Icon name="video" size={20} className="text-[var(--fg-3)]" />
                <div className="text-[13px] font-medium text-[var(--fg)]">No VoDs on this app yet</div>
                <div className="text-[12px] text-[var(--fg-3)] leading-relaxed">
                  Record a stream or upload a file first, or paste a video URL straight into the playlist item.
                </div>
              </>
            )}
          </div>
        ) : (
          rows.map(v => (
            <PickerRow
              key={v.vodId}
              appName={appName}
              vod={v}
              selected={selected.has(v.vodId)}
              onSelect={range => select(v.vodId, range)}
            />
          ))
        )}
      </div>

      <Pagination
        offset={offset}
        pageSize={pageSize}
        pageItemCount={rows.length}
        total={total}
        onOffset={setOffset}
        onPageSize={setPageSize}
      />
    </Modal>
  )
}

function PickerRow({ appName, vod, selected, onSelect }: {
  appName: string
  vod: VoD
  selected: boolean
  onSelect: (range: boolean) => void
}) {
  const ready = isVodReady(vod)

  return (
    <div
      role="button"
      aria-disabled={!ready}
      title={ready ? undefined : 'Still processing'}
      onClick={e => { if (ready) onSelect(e.shiftKey) }}
      className={cn(
        'flex items-center gap-3 px-3 py-2 border-b border-[var(--border)] last:border-b-0 transition-colors',
        ready ? 'cursor-pointer' : 'opacity-40',
        selected ? 'bg-[var(--bg-2)]' : ready && 'hover:bg-[var(--bg-2)]',
      )}
    >
      <span onClick={e => e.stopPropagation()} className={cn(!ready && 'pointer-events-none')}>
        <Checkbox checked={selected} onChange={(_, e) => ready && onSelect(e.shiftKey)} />
      </span>
      <VodThumb appName={appName} vod={vod} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-[var(--fg)] leading-tight truncate">{vodDisplayName(vod)}</div>
        <div className="mt-0.5 text-[11px] font-mono text-[var(--fg-3)] truncate">{vod.vodId}</div>
      </div>
      {typePill(vod)}
      <span className="w-[64px] text-right font-mono tabular-nums text-[12px] text-[var(--fg-2)]">
        {vod.duration ? fmtDuration(vod.duration) : '-'}
      </span>
      <span className="w-[84px] text-right font-mono tabular-nums text-[11.5px] text-[var(--fg-3)]">
        {vod.creationDate ? new Date(vod.creationDate).toLocaleDateString() : '-'}
      </span>
    </div>
  )
}

// First VoD-thumbnail consumer in the panel: previews only exist when the server
// generates them, so the icon box is the primary look and the image the bonus
// (onError falls back for dead paths too).
function VodThumb({ appName, vod }: { appName: string; vod: VoD }) {
  const [failed, setFailed] = useState(false)
  const src = vodPreviewUrl(appName, vod.previewFilePath)
  if (src && !failed) {
    return (
      <img
        src={src}
        onError={() => setFailed(true)}
        alt=""
        loading="lazy"
        className="w-[60px] h-[34px] object-cover rounded-[5px] bg-[var(--bg-3)] shrink-0"
      />
    )
  }
  return (
    <div className="w-[60px] h-[34px] rounded-[5px] bg-[var(--bg-3)] flex items-center justify-center text-[var(--fg-3)] shrink-0">
      <Icon name="video" size={14} />
    </div>
  )
}

function typePill(vod: VoD) {
  if (vod.processStatus === 'processing' || vod.processStatus === 'inqueue') return <Pill tone="warn" dot>processing</Pill>
  if (vod.processStatus === 'failed') return <Pill tone="err" dot>failed</Pill>
  return <Pill tone={vod.type === 'uploadedVod' ? 'info' : 'neutral'}>{vodTypeLabel(vod.type)}</Pill>
}
