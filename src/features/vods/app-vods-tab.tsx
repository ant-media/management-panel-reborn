import { useCallback, useState } from 'react'
import { Card } from '@/components/ui/card'
import { copyToClipboard } from '@/lib/clipboard'
import { useRangeSelection } from '@/lib/use-range-selection'
import { useToast } from '@/lib/use-toast'
import { ToastBanner } from '@/components/shared/toast'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { Pagination } from '@/components/shared/pagination'
import { DEFAULT_PAGE_SIZE, type PageSize } from '@/lib/page-size'
import type { MenuItem } from '@/components/shared/action-menu'
import { useAppSettings } from '@/features/apps/use-app-settings'
import { ConfirmDeleteVodsModal } from './confirm-delete-vods-modal'
import { ImportDirectoryModal } from './import-directory-modal'
import { UploadVodModal } from './upload-vod-modal'
import { VodPlayerModal } from './vod-player-modal'
import { VodsTable } from './vods-table'
import { VodsToolbar } from './vods-toolbar'
import { isVodReady, type VoD } from './types'
import { vodFileUrl } from './url-builder'
import { useVods, type SortDir, type VodSortKey } from './use-vods'

type Props = { appName: string }

export function AppVodsTab({ appName }: Props) {
  // List-query state. Sort/search/page-size changes reset offset so the user never
  // lands on an empty page.
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [sortKey, setSortKey] = useState<VodSortKey | null>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null)
  const [playing, setPlaying] = useState<VoD | null>(null)
  const { toast, flash, dismiss } = useToast()

  // Loaded up front so a gated VoD can mint its play token the instant Play is clicked.
  const { data: settings } = useAppSettings(appName)

  const { vods, total, error, isLoading, refresh } = useVods(appName, { offset, pageSize, search, sortKey, sortDir })

  // Shift-click range-select, shared with live streams and the future cross-app table.
  const { selected, select, toggleAll, remove } = useRangeSelection(vods?.map(v => v.vodId) ?? [])

  const onSort = useCallback((k: VodSortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
    setOffset(0)
  }, [sortKey])

  const updateSearch = (v: string) => { setSearch(v); setOffset(0) }

  const onDeleted = useCallback((ids: string[]) => {
    remove(ids)
    flash('ok', ids.length === 1 ? `Deleted ${ids[0]}` : `Deleted ${ids.length} VoDs`)
    refresh()
  }, [remove, flash, refresh])

  const buildRowMenu = useCallback((v: VoD): MenuItem[] => {
    const url = isVodReady(v) ? vodFileUrl(appName, v.filePath) : null
    const cp = (label: string, value: string) => { copyToClipboard(value); flash('ok', `Copied ${label}`) }
    const items: (MenuItem | null)[] = [
      url ? { icon: 'play', label: 'Play',     onClick: () => setPlaying(v) } : null,
      url ? { icon: 'link', label: 'Copy URL', hint: 'mp4', onClick: () => cp('VoD URL', url) } : null,
      { icon: 'copy',  label: 'Copy VoD ID',                onClick: () => cp('VoD ID', v.vodId) },
      'sep',
      { icon: 'trash', label: 'Delete', danger: true,       onClick: () => setPendingDelete([v.vodId]) },
    ]
    return items.filter((x): x is MenuItem => x !== null)
  }, [appName, flash])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0 w-full p-2.5 max-w-[1400px] mx-auto">
        {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}

        {error && <LoadErrorBanner entity="VoDs" error={error} onRetry={refresh} />}

        <Card className="overflow-hidden flex flex-col flex-1 min-h-0">
          <VodsToolbar
            search={search}
            onSearch={updateSearch}
            total={total}
            selectedCount={selected.size}
            onUpload={() => setUploadOpen(true)}
            onImport={() => setImportOpen(true)}
            onBulkDelete={() => selected.size > 0 && setPendingDelete(Array.from(selected))}
          />
          <VodsTable
            vods={vods}
            isLoading={isLoading}
            selected={selected}
            onToggle={select}
            onToggleAll={toggleAll}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            buildRowMenu={buildRowMenu}
            onPlay={setPlaying}
          />
          <Pagination
            offset={offset}
            pageSize={pageSize}
            pageItemCount={vods?.length ?? 0}
            total={total}
            onOffset={setOffset}
            onPageSize={setPageSize}
          />
        </Card>
      </div>

      <UploadVodModal
        appName={appName}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={name => { flash('ok', `Uploaded ${name}`); refresh() }}
      />
      <ImportDirectoryModal
        appName={appName}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { flash('ok', 'Folder imported'); refresh() }}
      />
      {pendingDelete && (
        <ConfirmDeleteVodsModal
          appName={appName}
          vodIds={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDeleted={onDeleted}
        />
      )}
      {playing && (
        <VodPlayerModal
          appName={appName}
          vod={playing}
          settings={settings}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  )
}
