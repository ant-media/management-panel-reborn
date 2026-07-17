import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api'
import { broadcasts as broadcastsApi } from '@/lib/api/endpoints'
import { downloadFile } from '@/lib/download'
import { useStoredState } from '@/lib/localStorage'
import { useIsNarrow } from '@/lib/use-is-narrow'
import { useViewportWidth } from '@/lib/use-viewport-width'
import { useRangeSelection } from '@/lib/use-range-selection'
import { useToast } from '@/lib/use-toast'
import { useSidebar } from '@/contexts/sidebar-context'
import { copyToClipboard } from '@/lib/clipboard'
import { ToastBanner } from '@/components/shared/toast'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { Pagination } from '@/components/shared/pagination'
import { DEFAULT_PAGE_SIZE, type PageSize } from '@/lib/page-size'
import type { MenuItem } from '@/components/shared/action-menu'
import { useAppSettings } from '@/features/apps/use-app-settings'
import { ConfirmDeleteStreamsModal } from './confirm-delete-streams-modal'
import { ConfirmForceStopModal } from './confirm-force-stop-modal'
import { EndpointsModal } from './endpoints-section'
import { ImportStreamsModal } from './import-streams-modal'
import { PlayerModal } from './player-modal'
import { EditStreamModal } from './editor/edit-stream-modal'
import { NewStreamModal } from './editor/new-stream-modal'
import { recordStream, STREAM_ACTIONS, streamAction, useStreamActions, type RecordType } from './stream-actions'
import { serializeStreams } from './stream-io'
import { StreamDetailDrawer } from './drawer/drawer'
import { type MetricKey } from './drawer/metrics'
import { StreamsTable } from './streams-table'
import { StreamsToolbar } from './streams-toolbar'
import { displayName, isEditable, isLive, recordingOn, type Broadcast } from './types'
import { embedSnippet, playPageUrl, rtmpIngestUrl } from './url-builder'
import { useBroadcastActions } from './use-broadcast-actions'
import { useBroadcasts, type SortDir, type SortKey } from './use-broadcasts'

type Props = {
  appName: string
  onOpenStream?: (b: Broadcast) => void
  onGoToSettings?: () => void
}

// Master-detail split layout constants (all in px). Widths are modelled off the
// (stable) viewport rather than the animating table row, so the compact decision
// never flickers mid-transition while the sidebar or dock animates.
// DETAIL_DOCK_WIDTH must match the docked panel's `w-[580px]` below; the sidebar
// widths mirror its `w-[256px]` / `w-[60px]`. FULL_TABLE_MIN_WIDTH is the width the
// full 9-column table needs before it cramps (measured ≈1020). Under that, beside
// the dock, the table degrades to the compact 4-column layout.
const DETAIL_DOCK_WIDTH = 580
const SIDEBAR_EXPANDED_WIDTH = 256
const SIDEBAR_COLLAPSED_WIDTH = 60
const FULL_TABLE_MIN_WIDTH = 1040

export function AppStreamsTab({ appName, onOpenStream, onGoToSettings }: Props) {
  // List-query state. Sort/search/page-size changes must reset offset so the user
  // doesn't land on an empty page; centralised in the small helpers below.
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [sortKey, setSortKey] = useState<SortKey | null>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Modal + mutation state.
  const [newOpen, setNewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportConfirm, setExportConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [endpointsTarget, setEndpointsTarget] = useState<Broadcast | null>(null)
  const [playing, setPlaying] = useState<Broadcast | null>(null)
  const [editing, setEditing] = useState<Broadcast | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null)
  const { toast, flash, dismiss } = useToast()
  const [detailId, setDetailId] = useState<string | null>(null)
  // The drawer's open chart. Lives here because the drawer remounts per stream (key={detailId});
  // dies with the tab, which is keyed by app name.
  const [metric, setMetric] = useState<MetricKey | null>(null)
  const isNarrow = useIsNarrow()
  // Below the split breakpoint the drawer is a full-screen overlay; above it, it
  // docks inline beside the table.
  const splitOpen = Boolean(detailId) && !isNarrow

  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()

  // Drive the docked layout off the (stable) viewport width, modelling the sidebar
  // and dock explicitly, rather than measuring the table row directly: the row
  // animates when the sidebar collapses, so a measured value would lag and make the
  // column set flicker mid-transition. Beside the dock the full table needs
  // FULL_TABLE_MIN_WIDTH; under that it degrades to the compact 4-column table.
  const viewportWidth = useViewportWidth()
  const tableWidthFor = (sidebarWidth: number) => viewportWidth - sidebarWidth - DETAIL_DOCK_WIDTH
  // Reclaim the sidebar only while docked and the full table wouldn't otherwise fit,
  // decided against the *expanded* width, so wide screens keep the sidebar and the
  // decision is independent of the collapse it triggers (no oscillation).
  const shouldCollapseSidebar = splitOpen && tableWidthFor(SIDEBAR_EXPANDED_WIDTH) < FULL_TABLE_MIN_WIDTH
  // Compact against the sidebar's *intended* docked width (collapsed if we're about
  // to reclaim it, or the user already did), so the full table renders from the
  // first frame and never flickers while the sidebar animates in.
  const intendedSidebarWidth = shouldCollapseSidebar || sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH
  const compact = splitOpen && tableWidthFor(intendedSidebarWidth) < FULL_TABLE_MIN_WIDTH

  // Reclaim the sidebar only while the split is docked *and* too tight to show the
  // full table, so wide screens keep both the sidebar and every column. Edge-
  // triggered on the decision (not every render) so a manual toggle isn't fought,
  // and only what we collapsed is restored.
  const collapseArmedRef = useRef(false)
  const weCollapsedRef = useRef(false)
  useEffect(() => {
    if (shouldCollapseSidebar && !collapseArmedRef.current) {
      collapseArmedRef.current = true
      if (!sidebarCollapsed) { weCollapsedRef.current = true; setSidebarCollapsed(true) }
    } else if (!shouldCollapseSidebar && collapseArmedRef.current) {
      collapseArmedRef.current = false
      if (weCollapsedRef.current) { weCollapsedRef.current = false; setSidebarCollapsed(false) }
    }
  }, [shouldCollapseSidebar, sidebarCollapsed, setSidebarCollapsed])

  // Navigating away while collapsed counts as closing, restore what we collapsed.
  useEffect(() => () => {
    if (weCollapsedRef.current) setSidebarCollapsed(false)
  }, [setSidebarCollapsed])

  // Open the drawer in-tab unless a parent claims it via onOpenStream.
  const openStream = useCallback((b: Broadcast) => {
    if (onOpenStream) onOpenStream(b)
    else setDetailId(b.streamId)
  }, [onOpenStream])

  // Per-app settings drive whether thumbnails should attempt to load.
  const { data: settings } = useAppSettings(appName)
  const hasPreview = Boolean(settings?.generatePreview)
  // Loaded settings + preview off → nudge once per app; dismissed apps are remembered
  // browser-side (a list of app names), so each app gets its own first-time notice.
  const [previewDismissedApps, setPreviewDismissedApps] = useStoredState<string[]>('streams_preview_notice_dismissed_apps', [])
  const showPreviewNotice = Boolean(settings) && !hasPreview && !previewDismissedApps.includes(appName)
  const dismissPreviewNotice = () => setPreviewDismissedApps(prev => (prev.includes(appName) ? prev : [...prev, appName]))

  const { broadcasts, total, activeLive, error, isLoading, refresh } = useBroadcasts(appName, {
    offset, pageSize, search, sortKey, sortDir, typeFilter: null,
  })

  const actions = useBroadcastActions(appName)
  // Start / Stop / Force Stop Ingest, shared by the row button, the ⋯ menu and the drawer.
  const { run: runAction, busy: actionBusy, confirming, dismissConfirm } = useStreamActions(appName, flash, refresh)

  // Shift-click range-select, shared with VoD and the future cross-app table.
  const { selected, select, toggleAll, remove } = useRangeSelection(broadcasts?.map(b => b.streamId) ?? [])

  const onSort = useCallback((k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
    setOffset(0)
  }, [sortKey])

  const updateSearch = (v: string) => { setSearch(v); setOffset(0) }

  // ── Mutations ───────────────────────────────────────────────────
  const onDeleted = useCallback((ids: string[]) => {
    remove(ids)
    setDetailId(curr => (curr && ids.includes(curr) ? null : curr))
    flash('ok', ids.length === 1 ? `Deleted ${ids[0]}` : `Deleted ${ids.length} streams`)
    refresh()
  }, [remove, flash, refresh])

  // ── Import / export ─────────────────────────────────────────────
  // Export walks the full paginated list (selection survives paging, so the
  // loaded page isn't enough), keeps only the definition fields, and downloads.
  const runExport = useCallback(async (onlySelected: boolean) => {
    setExporting(true)
    try {
      const all: Broadcast[] = []
      const PAGE = 50
      for (let off = 0; ; off += PAGE) {
        const page = await broadcastsApi(appName).list(off, PAGE, {})
        all.push(...page)
        if (page.length < PAGE) break
      }
      const chosen = onlySelected ? all.filter(b => selected.has(b.streamId)) : all
      if (chosen.length === 0) { flash('err', 'No streams to export'); return }

      downloadFile(`${appName}-streams-${chosen.length}.json`, serializeStreams(chosen, appName, Date.now()))
      flash('ok', `Exported ${chosen.length} stream${chosen.length === 1 ? '' : 's'}`)
    } catch (e) {
      flash('err', errorMessage(e, 'Export failed'))
    } finally {
      setExporting(false)
      setExportConfirm(false)
    }
  }, [appName, selected, flash])

  // With a selection, export just those (no confirm); otherwise confirm the full export.
  const onExport = useCallback(() => {
    if (selected.size > 0) void runExport(true)
    else setExportConfirm(true)
  }, [selected, runExport])

  const onImport = useCallback(() => { setImportOpen(true) }, [])

  const buildRowMenu = useCallback((b: Broadcast): MenuItem[] => {
    const live = isLive(b.status)
    const action = streamAction(b)
    const cp = (label: string, value: string) => {
      copyToClipboard(value)
      flash('ok', `Copied ${label}`)
    }
    const playInTab = (playOrder: 'webrtc' | 'hls') =>
      window.open(playPageUrl(appName, b.streamId, { playOrder }), '_blank', 'noopener')

    const mp4On = recordingOn(b.mp4Enabled, settings?.mp4MuxingEnabled)
    const webmOn = recordingOn(b.webMEnabled, settings?.webMMuxingEnabled)
    const recLabel = (on: boolean, kind: string) =>
      `${live ? (on ? 'Stop' : 'Start') : (on ? 'Disable' : 'Enable')} ${kind} Recording`
    // Red record dot while that mux type is on, gray otherwise (matches the menu's default icon tint).
    const recItemLabel = (on: boolean, kind: string) => (
      <span className="flex items-center gap-2">
        <Icon name="record" size={12} className={on ? 'text-[var(--danger)]' : 'text-[var(--fg-3)]'} />
        {recLabel(on, kind)}
      </span>
    )

    const setRecording = async (enable: boolean, type: RecordType) => {
      if (await recordStream(actions, b, type, enable, settings, flash)) refresh()
    }

    return [
      ...(action ? [{
        icon: STREAM_ACTIONS[action].icon,
        label: STREAM_ACTIONS[action].label,
        danger: action !== 'start',
        onClick: () => runAction(b, action),
      }] : []),
      { icon: 'edit', label: 'Edit Stream', disabled: !isEditable(b), onClick: () => setEditing(b) },
      'sep',
      { icon: 'code', label: 'Copy Embed Code',                onClick: () => cp('embed code',  embedSnippet(appName, b.streamId)) },
      { icon: 'copy', label: 'Copy Publish URL', hint: 'rtmp', onClick: () => cp('publish URL', rtmpIngestUrl(appName, b.streamId)) },
      { icon: 'play', label: 'Play', children: [
        { icon: 'maximize', label: 'Play Embedded Player', onClick: () => setPlaying(b) },
        { icon: 'video',    label: 'Play With WebRTC',     onClick: () => playInTab('webrtc') },
        { icon: 'play',     label: 'Play With HLS',        onClick: () => playInTab('hls') },
      ] },
      { icon: 'record', label: 'Recording', children: [
        { label: recItemLabel(mp4On, 'MP4'),   onClick: () => void setRecording(!mp4On, 'mp4') },
        { label: recItemLabel(webmOn, 'WebM'), onClick: () => void setRecording(!webmOn, 'webm') },
      ] },
      { icon: 'more-h', label: 'Other', children: [
        { icon: 'rss', label: 'Restream Endpoints', onClick: () => setEndpointsTarget(b) },
      ] },
      'sep',
      { icon: 'trash', label: 'Delete Broadcast', danger: true, onClick: () => setPendingDelete([b.streamId]) },
    ]
  }, [appName, flash, actions, refresh, settings, runAction])

  // Stable, or the drawer's ESC/focus effect re-runs on every 5s poll and steals focus back.
  const closeDetail = useCallback(() => setDetailId(null), [])

  const drawerProps = detailId && {
    appName,
    streamId: detailId,
    hasPreview,
    onClose: closeDetail,
    onFlash: flash,
    onMutated: refresh,
    onPlay: setPlaying,
    onAction: runAction,
    onEdit: setEditing,
    onDelete: (b: Broadcast) => setPendingDelete([b.streamId]),
    busy: actionBusy,
    buildMenu: buildRowMenu,
    metric,
    onMetric: setMetric,
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex min-h-0">
        {/* Table column, shrinks as the dock opens. */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className={cn('flex-1 flex flex-col min-h-0 w-full p-2.5', !splitOpen && 'max-w-[1400px] mx-auto')}>
            {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}

            {error && <LoadErrorBanner entity="streams" error={error} onRetry={refresh} />}

            {showPreviewNotice && (
              <div className="mb-3 flex items-start gap-2 text-[11.5px] text-[var(--fg-3)] px-2.5 py-2 rounded-[6px] bg-[var(--bg-2)]">
                <Icon name="info" size={12} className="mt-[2px] shrink-0" />
                <div className="flex-1">
                  Stream previews are off. Enable <span className="text-[var(--fg-2)] font-medium">Generate Preview</span> in{' '}
                  <button type="button" onClick={onGoToSettings} className="text-[var(--accent)] hover:underline">app settings</button>{' '}
                  to see thumbnails for live streams.
                </div>
                <button
                  type="button"
                  onClick={dismissPreviewNotice}
                  aria-label="Dismiss"
                  title="Don't show this again for this app"
                  className="shrink-0 text-[var(--fg-3)] hover:text-[var(--fg)]"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            )}

            <Card className="overflow-hidden flex flex-col flex-1 min-h-0">
              <StreamsToolbar
                search={search}
                onSearch={updateSearch}
                total={total}
                live={activeLive}
                selectedCount={selected.size}
                busy={actionBusy || exporting}
                onNewStream={() => setNewOpen(true)}
                onImport={onImport}
                onExport={onExport}
                onBulkDelete={() => selected.size > 0 && setPendingDelete(Array.from(selected))}
              />
              <StreamsTable
                appName={appName}
                broadcasts={broadcasts}
                isLoading={isLoading}
                selected={selected}
                onToggle={select}
                onToggleAll={toggleAll}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                hasPreview={hasPreview}
                onRowClick={openStream}
                buildRowMenu={buildRowMenu}
                onAction={runAction}
                onPlay={setPlaying}
                busy={actionBusy}
                compact={compact}
                activeId={detailId}
              />
              <Pagination
                offset={offset}
                pageSize={pageSize}
                pageItemCount={broadcasts?.length ?? 0}
                total={total}
                onOffset={setOffset}
                onPageSize={setPageSize}
              />
            </Card>
          </div>
        </div>

        {/* Width-animated dock; fixed-width inner wrapper clips instead of reflowing. */}
        <div className={cn(
          'shrink-0 overflow-hidden transition-[width] duration-200 ease-out',
          splitOpen ? 'w-[580px] border-l border-[var(--border)]' : 'w-0',
        )}>
          <div className="w-[580px] h-full">
            {splitOpen && drawerProps && <StreamDetailDrawer key={detailId} mode="inline" {...drawerProps} />}
          </div>
        </div>
      </div>

      {detailId && isNarrow && drawerProps && (
        <StreamDetailDrawer key={detailId} mode="overlay" {...drawerProps} />
      )}

      {playing && (
        <PlayerModal
          appName={appName}
          broadcast={playing}
          settings={settings}
          onClose={() => setPlaying(null)}
        />
      )}
      {editing && (
        <EditStreamModal
          appName={appName}
          broadcast={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh() }}
        />
      )}
      <NewStreamModal
        open={newOpen}
        appName={appName}
        onClose={() => setNewOpen(false)}
        onCreated={() => { setNewOpen(false); refresh() }}
      />
      {pendingDelete && (
        <ConfirmDeleteStreamsModal
          appName={appName}
          streamIds={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDeleted={onDeleted}
        />
      )}
      {confirming && (
        <ConfirmForceStopModal
          appName={appName}
          broadcast={confirming}
          onClose={dismissConfirm}
          onStopped={b => { flash('ok', `Stopped ${b.streamId}`); refresh() }}
        />
      )}
      <ImportStreamsModal
        appName={appName}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refresh}
      />
      <Modal
        open={exportConfirm}
        onClose={() => { if (!exporting) setExportConfirm(false) }}
        dismissible={!exporting}
        title="Export all streams"
        width="sm"
        icon="download"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setExportConfirm(false)} disabled={exporting}>Cancel</Button>
            <Button variant="primary" size="md" onClick={() => void runExport(false)} disabled={exporting} {...(exporting ? {} : { 'data-autofocus': true })}>
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] text-[var(--fg-2)]">
          Export all <span className="font-semibold text-[var(--fg)]">{total ?? '…'}</span> stream definitions to a JSON file. Runtime state (viewers, status, bitrate) is not included. Select streams first to export only those.
        </p>
      </Modal>
      {endpointsTarget && (
        <EndpointsModal
          appName={appName}
          streamId={endpointsTarget.streamId}
          streamName={displayName(endpointsTarget)}
          onClose={() => setEndpointsTarget(null)}
          onFlash={flash}
        />
      )}
    </div>
  )
}
