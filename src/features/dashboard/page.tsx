import { useState } from 'react'
import { useNavigate } from 'react-router'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { Collapse } from '@/components/shared/collapse'
import { Page } from '@/components/shared/page'
import { Pill } from '@/components/shared/pill'
import { threshColor } from '@/components/shared/ring'
import { NewAppModal } from '@/features/apps/new-app-modal'
import { useApplications } from '@/features/apps/use-applications'
import { useCluster } from '@/features/cluster/use-cluster'
import { fmtBytes, fmtCount, fmtUptime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApplicationsCard } from './applications-card'
import { ClusterSummaryCard } from './cluster-summary-card'
import { GpuCard } from './gpu-card'
import { HistoryPanel, type HistoryPanelProps } from './history-panel'
import { BandwidthRingCard, MemoryRingCard, RingCard, StatCard } from './tier-cards'
import { useDashboardData, type DashboardData, type DashboardMetrics } from './use-dashboard-data'

type OpenKey = 'cpu' | 'db' | 'live' | 'disk' | 'memory' | 'bandwidth'
const TIER1_KEYS: OpenKey[] = ['cpu', 'db', 'live']
type Capacity = { usedBytes: number; totalBytes: number; freeBytes: number }

export function DashboardPage() {
  const { metrics, history, network, version, licence, error, isLoading, refresh } = useDashboardData()
  const { apps, isLoading: appsLoading, refresh: refreshApps } = useApplications()
  const { inCluster, nodes } = useCluster()
  const navigate = useNavigate()
  const [openKey, setOpenKey] = useState<OpenKey | null>(null)
  // Last-opened card per tier, retained after close so the collapse can animate the
  // panel *out* (nulling it on close would make the exit instant).
  const [shownTier1Key, setShownTier1Key] = useState<OpenKey | null>(null)
  const [shownTier2Key, setShownTier2Key] = useState<OpenKey | null>(null)
  const [newAppOpen, setNewAppOpen] = useState(false)

  const net = { out: network?.outboundMbps ?? 0, in: network?.inboundMbps ?? 0, link: network?.uplinkMbps ?? 0 }
  const tier1Open = openKey != null && TIER1_KEYS.includes(openKey)
  const tier2Open = openKey != null && !tier1Open
  // Panels render from the retained key (live data), so they stay populated while collapsing.
  const tier1Detail = shownTier1Key ? historyPanel(shownTier1Key, metrics, history, net) : null
  const tier2Detail = shownTier2Key ? historyPanel(shownTier2Key, metrics, history, net) : null
  const toggle = (k: OpenKey) => {
    if (openKey === k) { setOpenKey(null); return } // close, keep the retained key so it animates out
    if (TIER1_KEYS.includes(k)) setShownTier1Key(k)
    else setShownTier2Key(k)
    setOpenKey(k)
  }
  const refreshAll = () => { refresh(); refreshApps() }

  const showGpu = metrics.gpus.length > 0
  const showCluster = inCluster && nodes.length > 0
  const showHardware = showGpu || showCluster

  return (
    <Page
      title="Dashboard"
      subtitle={<HeaderInfo version={version} licence={licence} uptimeMs={metrics.uptimeMs} />}
    >
      {error && <LoadErrorBanner entity="dashboard data" error={error} onRetry={refreshAll} className="mb-5" />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <StatCard
          icon="cpu"
          label="System CPU"
          value={fmtNumber(metrics.cpu?.systemPct, 0)}
          unit="%"
          sub={metrics.cpu ? `Process · ${fmtNumber(metrics.cpu.processPct, 1)}%` : '-'}
          series={history.cpu}
          open={openKey === 'cpu'} onClick={() => toggle('cpu')}
        />
        <StatCard
          icon="clock"
          label="DB query average"
          value={fmtNumber(metrics.dbAvgMs, 0)}
          unit="ms"
          sub={metrics.dbAvgMs == null ? 'No applications reporting' : 'Averaged across applications'}
          series={history.db}
          open={openKey === 'db'} onClick={() => toggle('db')}
        />
        <StatCard
          icon="video"
          label="Live streams"
          value={metrics.live ? metrics.live.streams : '-'}
          sub={metrics.live ? `${fmtCount(metrics.live.viewers)} viewers · ${metrics.live.webrtc} WebRTC · ${metrics.live.hls} HLS` : '-'}
          pill={(metrics.live?.streams ?? 0) > 0 ? <Pill tone="live" dot>live</Pill> : null}
          series={history.live}
          open={openKey === 'live'} onClick={() => toggle('live')}
        />
      </div>

      <Collapse open={tier1Open}>
        <div className="mb-5">
          {tier1Detail && <HistoryPanel {...tier1Detail} onClose={() => setOpenKey(null)} />}
        </div>
      </Collapse>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <RingCard
          icon="hard-drive" title="System Disk"
          pct={metrics.disk?.pct ?? 0} capacity={capLabel(metrics.disk)} sub={freeLabel(metrics.disk)}
          open={openKey === 'disk'} onClick={() => toggle('disk')}
        />
        <MemoryRingCard
          memPct={metrics.systemMem?.pct ?? 0} heapPct={metrics.heap?.pct ?? 0} heapUsedBytes={metrics.heap?.usedBytes ?? 0}
          capacity={capLabel(metrics.systemMem)}
          open={openKey === 'memory'} onClick={() => toggle('memory')}
        />
        <BandwidthRingCard out={net.out} inb={net.in} link={net.link} outHistory={history.netOut} inHistory={history.netIn} open={openKey === 'bandwidth'} onClick={() => toggle('bandwidth')} />
      </div>

      <Collapse open={tier2Open}>
        <div className="mb-5">
          {tier2Detail && <HistoryPanel {...tier2Detail} onClose={() => setOpenKey(null)} />}
        </div>
      </Collapse>

      {showHardware && (
        <div className={cn('grid gap-5 mb-5', showGpu && showCluster ? 'lg:grid-cols-2' : 'grid-cols-1')} style={{ alignItems: 'start' }}>
          {showGpu && <GpuCard gpus={metrics.gpus} />}
          {showCluster && <ClusterSummaryCard nodes={nodes} />}
        </div>
      )}

      <ApplicationsCard apps={apps} isLoading={appsLoading || isLoading} onNewApp={() => setNewAppOpen(true)} />

      <NewAppModal
        open={newAppOpen}
        onClose={() => setNewAppOpen(false)}
        onCreated={name => void navigate(`/apps/${encodeURIComponent(name)}`)}
      />
    </Page>
  )
}

function HeaderInfo({ version, licence, uptimeMs }: {
  version: DashboardData['version']
  licence: DashboardData['licence']
  uptimeMs: number | null
}) {
  const versionLabel = version ? `${version.versionType ?? ''} ${version.versionName ?? ''}`.trim() || 'Unknown' : '…'
  const licenceLabel = licence?.type ?? null
  const licenceTone = licence?.status?.toLowerCase() === 'ok' ? 'ok' : licence ? 'warn' : 'neutral'
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span>System overview</span>
      <span className="text-[var(--border-strong)]">·</span>
      <span className="font-mono text-[12px]">{versionLabel}</span>
      {uptimeMs != null && (
        <>
          <span className="text-[var(--border-strong)]">·</span>
          <span>up {fmtUptime(uptimeMs)}</span>
        </>
      )}
      {licenceLabel && <Pill tone={licenceTone}>licence: {licenceLabel}</Pill>}
    </div>
  )
}

const capLabel = (c: Capacity | null) => (c ? `${fmtBytes(c.usedBytes)} / ${fmtBytes(c.totalBytes)}` : '-')
const freeLabel = (c: Capacity | null, suffix = 'free') => (c ? `${fmtBytes(c.freeBytes)} ${suffix}` : '-')

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtNumber(v: number | null | undefined, digits = 0): number | string {
  if (v == null || !Number.isFinite(v)) return '-'
  return digits === 0 ? Math.round(v) : Number(v.toFixed(digits))
}

function historyPanel(
  key: OpenKey,
  m: DashboardMetrics,
  history: DashboardData['history'],
  net: { out: number; in: number; link: number },
): Omit<HistoryPanelProps, 'onClose'> {
  if (key === 'cpu') {
    const pct = m.cpu?.systemPct
    return {
      icon: 'cpu',
      title: 'System CPU',
      hint: m.cpu ? `process ${fmtNumber(m.cpu.processPct, 1)}%` : '-',
      current: pct != null ? `${Math.round(pct)}%` : '-',
      yMax: 100,
      yFormat: v => `${Math.round(v)}%`,
      series: [{ data: history.cpu, color: threshColor(pct ?? 0) }],
    }
  }
  if (key === 'db') {
    return {
      icon: 'clock',
      title: 'DB query average',
      hint: 'averaged across applications',
      current: m.dbAvgMs != null ? `${Math.round(m.dbAvgMs)} ms` : '-',
      yFormat: v => `${Math.round(v)} ms`,
      series: [{ data: history.db, color: 'var(--info)' }],
    }
  }
  if (key === 'live') {
    return {
      icon: 'video',
      title: 'Live streams',
      hint: m.live ? `${fmtCount(m.live.viewers)} viewers · ${m.live.webrtc} WebRTC · ${m.live.hls} HLS` : '-',
      current: m.live ? String(m.live.streams) : '-',
      yFormat: v => String(Math.round(v)),
      series: [{ data: history.live, color: 'var(--accent)' }],
    }
  }
  if (key === 'bandwidth') {
    return {
      icon: 'network',
      title: 'Network bandwidth',
      hint: `of ${net.link} Mbps uplink`,
      current: `${net.out} / ${net.in} Mbps`,
      yFormat: v => `${Math.round(v)} Mbps`,
      legend: [{ label: `Up ${net.out} Mbps`, color: 'var(--ok)' }, { label: `Down ${net.in} Mbps`, color: 'var(--info)' }],
      series: [{ data: history.netOut, color: 'var(--ok)' }, { data: history.netIn, color: 'var(--info)' }],
    }
  }
  if (key === 'memory') {
    const sysTotal = m.systemMem?.totalBytes ?? 0
    const heapTotal = m.heap?.totalBytes ?? 0
    const sysUsed = fmtBytes(m.systemMem?.usedBytes ?? 0)
    const heapUsed = fmtBytes(m.heap?.usedBytes ?? 0)
    // Convert pct (0-100) to bytes: (pct / 100) * total
    const fmtSysMem = (pct: number) => fmtBytes((pct / 100) * sysTotal)
    const fmtHeapMem = (pct: number) => fmtBytes((pct / 100) * heapTotal)
    return {
      icon: 'memory',
      title: 'Memory',
      hint: `system ${capLabel(m.systemMem)} · heap ${capLabel(m.heap)}`,
      current: `${sysUsed} / ${heapUsed}`,
      yMax: 100,
      yFormat: (v, seriesIdx) => seriesIdx === 0 ? fmtSysMem(v) : fmtHeapMem(v),
      legend: [{ label: `System ${sysUsed}`, color: 'var(--info)' }, { label: `Heap ${heapUsed}`, color: 'var(--ok)' }],
      series: [{ data: history.mem, color: 'var(--info)' }, { data: history.heap, color: 'var(--ok)' }],
    }
  }
  const diskTotal = m.disk?.totalBytes ?? 0
  const diskUsed = fmtBytes(m.disk?.usedBytes ?? 0)
  const fmtDisk = (pct: number) => fmtBytes((pct / 100) * diskTotal)
  return {
    icon: 'hard-drive',
    title: 'System Disk',
    hint: capLabel(m.disk),
    current: diskUsed,
    yMax: 100,
    yFormat: fmtDisk,
    series: [{ data: history.disk, color: threshColor(m.disk?.pct ?? 0) }],
  }
}
