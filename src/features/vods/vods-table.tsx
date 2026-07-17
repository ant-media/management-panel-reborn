import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/shared/pill'
import { ActionMenu, type MenuItem } from '@/components/shared/action-menu'
import { CopyChip } from '@/components/shared/copy-chip'
import { SortableTh } from '@/components/shared/sortable-header'
import { cn } from '@/lib/utils'
import { fmtBytes, fmtDuration } from '@/lib/format'
import { isVodReady, vodDisplayName, vodTypeLabel, type VoD } from './types'
import type { SortDir, VodSortKey } from './use-vods'

type Props = {
  vods: VoD[] | null
  isLoading: boolean
  selected: Set<string>
  onToggle: (id: string, range: boolean) => void   // range = shift held → select span
  onToggleAll: () => void
  sortKey: VodSortKey | null
  sortDir: SortDir
  onSort: (k: VodSortKey) => void
  buildRowMenu: (v: VoD) => MenuItem[]
  onPlay: (v: VoD) => void
}

const COLS = 7

export function VodsTable({
  vods, isLoading, selected, onToggle, onToggleAll, sortKey, sortDir, onSort, buildRowMenu, onPlay,
}: Props) {
  const allSelected = vods != null && vods.length > 0 && vods.every(v => selected.has(v.vodId))

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-[var(--card)] z-10">
          <tr className="text-[11px] uppercase tracking-wider text-[var(--fg-3)] border-b border-[var(--border)]">
            <th className="text-left px-4 py-2 w-8">
              <Checkbox checked={allSelected} onChange={onToggleAll} />
            </th>
            <SortableTh<VodSortKey> k="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="text-left font-medium px-3 py-2 w-[120px]">Type</th>
            <th className="text-right font-medium px-3 py-2 w-[90px]">Duration</th>
            <th className="text-right font-medium px-3 py-2 w-[90px]">Size</th>
            <SortableTh<VodSortKey> k="date" label="Created" align="right" width="w-[140px]" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="text-right font-medium px-3 py-2 w-[80px]" />
          </tr>
        </thead>
        <tbody>
          {vods?.map(v => (
            <Row
              key={v.vodId}
              vod={v}
              selected={selected.has(v.vodId)}
              onToggle={range => onToggle(v.vodId, range)}
              menu={buildRowMenu(v)}
              onPlay={() => onPlay(v)}
            />
          ))}
          {vods != null && vods.length === 0 && (
            <tr>
              <td colSpan={COLS} className="px-5 py-12 text-center text-[12px] text-[var(--fg-3)]">
                {isLoading ? 'Loading VoDs…' : 'No recordings or uploads yet.'}
              </td>
            </tr>
          )}
          {vods == null && (
            <tr>
              <td colSpan={COLS} className="px-5 py-12 text-center text-[12px] text-[var(--fg-3)]">
                {isLoading ? 'Loading VoDs…' : '-'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Row({ vod, selected, onToggle, menu, onPlay }: {
  vod: VoD
  selected: boolean
  onToggle: (range: boolean) => void
  menu: MenuItem[]
  onPlay: () => void
}) {
  const ready = isVodReady(vod)

  return (
    <tr className={cn('border-b border-[var(--border)] transition-colors', selected ? 'bg-[var(--bg-2)]' : 'hover:bg-[var(--bg-2)]')}>
      <td className="pl-4 pr-1 py-2 select-none">
        <Checkbox checked={selected} onChange={(_, e) => onToggle(e.shiftKey)} />
      </td>
      <td className="px-3 py-2 min-w-0">
        <div className="flex items-center gap-1.5 max-w-[360px]">
          <Icon name="video" size={13} className="text-[var(--fg-3)] shrink-0" />
          <span className="font-medium text-[var(--fg)] leading-tight truncate">{vodDisplayName(vod)}</span>
        </div>
        <div className="mt-0.5 pl-[19px]">
          <CopyChip value={vod.vodId} />
        </div>
      </td>
      <td className="px-3 py-2">{typePill(vod)}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--fg-2)]">
        {vod.duration ? fmtDuration(vod.duration) : <span className="text-[var(--fg-3)]">-</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--fg-2)]">
        {vod.fileSize ? fmtBytes(vod.fileSize) : <span className="text-[var(--fg-3)]">-</span>}
      </td>
      <td className="px-3 py-2 text-right text-[var(--fg-3)] font-mono tabular-nums text-[11.5px]">
        {vod.creationDate ? new Date(vod.creationDate).toLocaleDateString() : '-'}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex items-center gap-0.5">
          <Button variant="ghost" size="iconSm" title={ready ? 'Play' : 'Still processing'} disabled={!ready} onClick={onPlay}>
            <Icon name="play" size={13} className={ready ? 'text-[var(--ok)]' : undefined} />
          </Button>
          <ActionMenu items={menu} />
        </div>
      </td>
    </tr>
  )
}

function typePill(vod: VoD) {
  if (vod.processStatus === 'processing' || vod.processStatus === 'inqueue') return <Pill tone="warn" dot>processing</Pill>
  if (vod.processStatus === 'failed') return <Pill tone="err" dot>failed</Pill>
  const tone = vod.type === 'uploadedVod' ? 'info' : 'neutral'
  return <Pill tone={tone}>{vodTypeLabel(vod.type)}</Pill>
}
