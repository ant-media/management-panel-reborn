import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { MeterBar } from '@/components/shared/meter-bar'
import { Pill } from '@/components/shared/pill'
import { threshColor } from '@/components/shared/ring'
import { cn } from '@/lib/utils'
import type { NodeView } from '@/features/cluster/types'

// Dashboard cluster summary: per-node CPU/memory at a glance, with a link out to the full
// /cluster page. Reads the same real node list the cluster page does (useCluster, lifted to
// the dashboard page so it can gate this card on `inCluster`). The prototype showed per-node
// trend sparklines; those need a cluster time-series the backend lacks (see
// dashboard-widgets.md), so current-value meters stand in.
export function ClusterSummaryCard({ nodes }: { nodes: NodeView[] }) {
  const healthy = nodes.filter(n => n.health === 'healthy').length
  return (
    <Card className="p-6 transition-all hover:border-[var(--border-strong)] hover:shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon name="cluster" size={16} className="text-[var(--fg-3)]" />
          <span className="text-[14px] font-medium tracking-tight text-[var(--fg)]">Cluster nodes</span>
        </div>
        <Pill tone={healthy === nodes.length ? 'ok' : 'warn'} dot>{healthy} of {nodes.length} healthy</Pill>
      </div>

      <div className="flex flex-col">
        {nodes.map(n => <NodeRow key={n.id} node={n} />)}
      </div>
    </Card>
  )
}

// Two rows per node: identity (status dot · full IP · note) on top, CPU/Memory meters below;
// gives the IP room to render in full instead of collapsing to "10…".
function NodeRow({ node: n }: { node: NodeView }) {
  const dead = n.status === 'dead'
  const dot = n.health === 'healthy' ? 'var(--ok)' : n.health === 'warn' ? 'var(--warn)' : 'var(--fg-3)'
  return (
    <div className={cn('flex flex-col gap-2 py-3 border-b border-[var(--border)] last:border-0', dead && 'opacity-60')}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
        <span className="text-[12.5px] font-mono text-[var(--fg)] shrink-0">{n.ip}</span>
        {n.note && <span className="text-[11.5px] text-[var(--fg-3)] truncate min-w-0">· {n.note}</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-4">
        <Meter label="CPU" pct={dead ? 0 : n.cpuPct} tone={threshColor(n.cpuPct ?? 0)} />
        <Meter label="Mem" pct={dead ? 0 : n.memPct} tone="var(--info)" />
      </div>
    </div>
  )
}

function Meter({ label, pct, tone }: { label: string; pct: number | null; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10.5px] uppercase tracking-wider text-[var(--fg-3)] w-7 shrink-0">{label}</span>
      <MeterBar pct={pct} tone={tone} className="flex-1" />
      <span className="text-[11.5px] font-mono tabular-nums text-[var(--fg-2)] w-9 text-right shrink-0">{pct == null ? '-' : `${pct}%`}</span>
    </div>
  )
}
