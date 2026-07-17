import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { Page } from '@/components/shared/page'
import { Pill } from '@/components/shared/pill'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { ToastBanner } from '@/components/shared/toast'
import { errorMessage, resultMessage } from '@/lib/api'
import { useToast } from '@/lib/use-toast'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { fmtCount } from '@/lib/format'
import { useCluster } from './use-cluster'
import { NodeCard } from './node-card'

const valueTone = (pct: number) => (pct >= 85 ? 'var(--danger)' : pct >= 60 ? 'var(--warn)' : 'var(--fg)')
const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

export function ClusterPage() {
  const { inCluster, nodes, error, isLoading, isFetching, refresh, saveNote } = useCluster()
  const { toast, flash, dismiss } = useToast()

  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const counts = useMemo(() => ({
    healthy: nodes.filter(n => n.health === 'healthy').length,
    warn: nodes.filter(n => n.health === 'warn').length,
    dead: nodes.filter(n => n.status === 'dead').length,
  }), [nodes])

  const summary = useMemo(() => {
    const alive = nodes.filter(n => n.status === 'alive')
    const gpu = alive.filter(n => n.gpuPct != null)
    return {
      avgCpu: mean(alive.map(n => n.cpuPct).filter((x): x is number => x != null)),
      avgGpu: gpu.length ? mean(gpu.map(n => n.gpuPct as number)) : null,
      gpuNodes: gpu.length,
      aliveNodes: alive.length,
      streams: alive.reduce((a, n) => a + (n.streams ?? 0), 0),
      viewers: alive.reduce((a, n) => a + (n.viewers ?? 0), 0),
    }
  }, [nodes])

  // A note is dirty only when the draft differs from the saved value; typing back to
  // the original silently clears it. dirtyIds drives the per-card unsaved dot.
  const dirty = useMemo(
    () => nodes.filter(n => n.id in noteEdits && noteEdits[n.id] !== n.note),
    [nodes, noteEdits],
  )
  const dirtyIds = useMemo(() => new Set(dirty.map(n => n.id)), [dirty])

  const onNote = (id: string, value: string) => setNoteEdits(prev => ({ ...prev, [id]: value }))

  const onSave = async () => {
    setSaving(true)
    try {
      // refresh() re-pulls saved notes; the dirty diff then drops whatever actually
      // persisted, so on a partial failure the still-unsaved cards stay flagged.
      const results = await Promise.all(dirty.map(n => saveNote(n.id, noteEdits[n.id])))
      refresh()
      if (results.every(r => r?.success)) {
        setNoteEdits({})
        flash('ok', 'Notes saved')
      } else {
        // Several notes save at once, so report the first reason the server gave rather than
        // dropping all of them (a stale node id is the likely one, and it names itself).
        const why = results.filter(r => !r?.success).map(r => r && resultMessage(r)).find(Boolean)
        flash('err', why
          ? `Could not save notes: ${why}`
          : 'Could not save notes. The server gave no reason. Check the server logs.')
      }
    } catch (e) {
      flash('err', errorMessage(e, 'Could not save notes. Check that the server is reachable.'))
    } finally {
      setSaving(false)
    }
  }

  const onCopyIp = (ip: string) => {
    const ok = copyToClipboard(ip)
    flash(ok ? 'ok' : 'err', ok ? `Copied ${ip}` : 'Copy failed')
  }
  const onShowLogs = (ip: string) => flash('ok', `Per-node logs for ${ip}: TODO`)

  const subtitle = inCluster ? (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {nodes.length} node{nodes.length === 1 ? '' : 's'}
      {counts.healthy > 0 && <Pill tone="ok" dot>{counts.healthy} healthy</Pill>}
      {counts.warn > 0 && <Pill tone="warn" dot>{counts.warn} warn</Pill>}
      {counts.dead > 0 && <Pill tone="neutral" dot>{counts.dead} offline</Pill>}
    </span>
  ) : 'Node health across the cluster'

  return (
    <Page title="Cluster" subtitle={subtitle}>
      {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}
      {error && !isFetching && <LoadErrorBanner entity="cluster nodes" error={error} onRetry={refresh} />}

      {isLoading ? (
        <EmptyCard title="Loading cluster…" />
      ) : !inCluster ? (
        <EmptyCard
          title="This server is standalone"
          body="It isn’t part of a cluster, so there are no peer nodes to show. The cluster view lists per-node health once this server joins a cluster group (enterprise edition with MongoDB or Redis cluster mode)."
        />
      ) : nodes.length === 0 ? (
        <EmptyCard title="Waiting for nodes…" body="Cluster mode is active but no nodes have reported yet." />
      ) : (
        <div className="flex flex-col gap-5">
          <div className={cn('grid gap-3', summary.avgGpu != null ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3')}>
            <SummaryStat icon="cpu" label="Avg CPU" value={`${summary.avgCpu}%`} tone={valueTone(summary.avgCpu)} />
            {summary.avgGpu != null && (
              <SummaryStat icon="gpu" label="Avg GPU" value={`${summary.avgGpu}%`} tone={valueTone(summary.avgGpu)} sub={`${summary.gpuNodes} of ${summary.aliveNodes} nodes`} />
            )}
            <SummaryStat icon="rss" label="Active streams" value={String(summary.streams)} />
            <SummaryStat icon="users" label="Total viewers" value={fmtCount(summary.viewers)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {nodes.map(n => (
              <NodeCard key={n.id} node={n} note={noteEdits[n.id] ?? n.note} dirty={dirtyIds.has(n.id)} onNote={onNote} onCopyIp={onCopyIp} onShowLogs={onShowLogs} />
            ))}
          </div>
        </div>
      )}

      {dirty.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3 py-2 bg-[var(--fg)] text-[var(--bg)] rounded-[10px] shadow-2xl">
          <span className="text-[12px] font-medium">{dirty.length} note{dirty.length > 1 ? 's' : ''} changed</span>
          <button onClick={() => setNoteEdits({})} disabled={saving} className="text-[11.5px] opacity-70 hover:opacity-100 disabled:opacity-40">Discard</button>
          <button onClick={onSave} disabled={saving} className="h-7 px-3 bg-[var(--accent)] text-white rounded-[6px] text-[12px] font-medium hover:brightness-110 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </Page>
  )
}

function SummaryStat({ icon, label, value, tone, sub }: { icon: IconName; label: string; value: string; tone?: string; sub?: string }) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-[8px] bg-[var(--bg-2)] flex items-center justify-center shrink-0">
        <Icon name={icon} size={15} className="text-[var(--fg-2)]" />
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-wider text-[var(--fg-3)]">{label}</div>
        <div className="text-[18px] font-semibold tabular-nums leading-tight" style={{ color: tone ?? 'var(--fg)' }}>{value}</div>
        {sub && <div className="text-[10px] text-[var(--fg-3)] leading-tight">{sub}</div>}
      </div>
    </Card>
  )
}

function EmptyCard({ title, body }: { title: string; body?: string }) {
  return (
    <Card className="p-12 flex items-center justify-center">
      <div className={cn('text-center', body ? 'max-w-md' : '')}>
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-2)] flex items-center justify-center mb-3">
          <Icon name="cluster" size={20} className="text-[var(--fg-3)]" aria-hidden />
        </div>
        <div className="text-[13px] text-[var(--fg-2)] mb-1">{title}</div>
        {body && <div className="text-[11.5px] text-[var(--fg-3)] leading-relaxed">{body}</div>}
      </div>
    </Card>
  )
}
