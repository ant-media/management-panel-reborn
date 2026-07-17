import type { KeyboardEvent, ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { DualRing, Ring } from '@/components/shared/ring'
import { Sparkline } from '@/components/shared/sparkline'
import { ExpandHandle } from '@/components/shared/expand-handle'
import { cn } from '@/lib/utils'

// Makes a Card behave as an accessible disclosure toggle: pointer + keyboard
// (Enter/Space) + aria-expanded. The card must hold no other interactive element.
function expandableProps(open: boolean, onClick: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-expanded': open,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
    },
  }
}

// Mbps display: drop the decimal once we're into 3 digits (it's just noise there),
// keep one decimal below 100.
const fmtMbps = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10)

// Rings stay a calm green (no red escalation). High usage is signalled by a faint red
// tint on the hero number above ~80%, not by recolouring the circle.
const RING_COLOR = 'var(--ok)'
const heroTint = (pct: number) => (pct > 80 ? 'color-mix(in oklch, var(--fg), var(--danger) 15%)' : 'var(--fg)')

// Ladder of "nice" ceilings (Mbps) a network ring auto-scales against: the smallest step
// at least ~15% above the recent peak, so a 30 Mbps flow on a 1 Gbps NIC still reads as a
// real arc instead of a dead sliver. Falls through to the peak itself past the top step.
const NICE_MAX_LADDER = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 40000, 100000]
const niceMax = (peak: number) => NICE_MAX_LADDER.find(s => s >= peak * 1.15) ?? Math.max(peak, 1)

// ── Tier 1: big-number status card with a subtle trend behind ────────────────
// Clickable (open/onClick) → drives the same shared HistoryPanel as the Tier-2 meters.
type StatCardProps = {
  icon: IconName
  label: string
  value: number | string
  unit?: string
  sub?: string
  pill?: ReactNode
  series: number[]
  open?: boolean
  onClick?: () => void
}

export function StatCard({ icon, label, value, unit, sub, pill, series, open = false, onClick }: StatCardProps) {
  return (
    <Card
      {...(onClick ? expandableProps(open, onClick) : {})}
      className={cn(
        // flex-col so the content grows (flex-1) and the handle pins to the bottom
        // even when the grid stretches a shorter card to match a taller sibling.
        'group p-4 relative overflow-hidden flex flex-col transition-all outline-none',
        onClick && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        onClick && (open
          ? 'border-[var(--border-strong)] shadow-md'
          : 'hover:bg-[var(--card-hover)] hover:border-[var(--border-strong)] hover:shadow-sm'),
      )}
    >
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-[var(--fg-3)] min-w-0">
            <Icon name={icon} size={14} />
            <span className="text-[12px] font-medium tracking-tight truncate">{label}</span>
          </div>
          {pill && <div className="shrink-0">{pill}</div>}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[30px] font-semibold tabular-nums tracking-[-0.02em] leading-none text-[var(--fg)]">{value}</span>
          {unit && <span className="text-[14px] text-[var(--fg-3)] font-medium">{unit}</span>}
        </div>
        {sub && <div className="text-[12px] text-[var(--fg-3)] mt-2 relative z-10">{sub}</div>}
      </div>
      {series.length > 1 && (
        <div
          className={cn('absolute left-0 right-0 h-8 pointer-events-none', onClick ? 'bottom-4' : 'bottom-0')}
          // Theme-aware: brighter in dark mode (see --spark-opacity in index.css).
          style={{ opacity: open ? 'var(--spark-opacity-open)' : 'var(--spark-opacity)' }}
        >
          <Sparkline data={series} full height={32} stroke="var(--fg-3)" strokeWidth={1} />
        </div>
      )}
      {onClick && <ExpandHandle open={open} className="relative mt-2 -mx-4 -mb-4" />}
    </Card>
  )
}

// ── Tier 2: shared compact-meter shell ───────────────────────────────────────
function MeterShell({ open, onClick, title, children }: { open: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <Card
      {...expandableProps(open, onClick)}
      title={title}
      className={cn(
        'group p-5 flex flex-col items-center text-center cursor-pointer transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        open
          ? 'border-[var(--border-strong)] shadow-md'
          : 'hover:bg-[var(--card-hover)] hover:border-[var(--border-strong)] hover:shadow-sm hover:-translate-y-px',
      )}
    >
      {/* flex-1 content + pinned handle, same bottom-pin as StatCard, so the
          handle stays flush even if a sibling ring card grows taller. */}
      <div className="flex-1 self-stretch flex flex-col items-center">{children}</div>
      <ExpandHandle open={open} className="self-stretch mt-2 -mx-5 -mb-5" />
    </Card>
  )
}

function MeterFooter({ sub }: { sub: ReactNode }) {
  return <div className="mt-3 text-[11.5px] text-[var(--fg-3)]">{sub}</div>
}

// ── Tier 2: capacity ring meter (disk / memory / heap) ───────────────────────
type RingCardProps = {
  icon: IconName
  title: string
  capacity: string
  pct: number
  sub: string
  open: boolean
  onClick: () => void
}

export function RingCard({ icon, title, capacity, pct, sub, open, onClick }: RingCardProps) {
  const p = Math.round(pct)
  return (
    <MeterShell open={open} onClick={onClick}>
      <div className="flex items-center gap-2 text-[var(--fg-2)]">
        <Icon name={icon} size={14} className="text-[var(--fg-3)]" />
        <span className="text-[13px] font-medium tracking-tight">{title}</span>
      </div>
      <div className="text-[11px] text-[var(--fg-3)] font-mono mt-0.5 mb-4">{capacity}</div>
      <Ring pct={p} size={120} thickness={11} color={RING_COLOR}>
        <span className="text-[30px] font-semibold tabular-nums tracking-[-0.02em] leading-none" style={{ color: heroTint(pct) }}>{p}%</span>
        <span className="text-[10.5px] text-[var(--fg-3)] mt-1">Used</span>
      </Ring>
      <MeterFooter sub={sub} />
    </MeterShell>
  )
}

// ── Tier 2: memory dual-ring meter (system RAM outer · JVM heap inner) ───────
type MemoryRingCardProps = {
  memPct: number
  heapPct: number
  heapUsedBytes: number
  capacity: string
  open: boolean
  onClick: () => void
}

// Heap as MB, switching to GB once it'd exceed 3 digits of MB (>999 MB).
function fmtHeap(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb > 999 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

export function MemoryRingCard({ memPct, heapPct, heapUsedBytes, capacity, open, onClick }: MemoryRingCardProps) {
  const sys = Math.round(memPct)
  const heap = fmtHeap(heapUsedBytes)
  return (
    // Hero ring = system RAM (the number); the thin glued companion is JVM heap (a subset
    // of system memory), shown as an arc only: its used size is in the footer + hover title.
    <MeterShell open={open} onClick={onClick} title={`System memory ${sys}% · JVM heap ${heap}`}>
      <div className="flex items-center gap-2 text-[var(--fg-2)]">
        <Icon name="memory" size={14} className="text-[var(--fg-3)]" />
        <span className="text-[13px] font-medium tracking-tight">Memory</span>
      </div>
      <div className="text-[11px] text-[var(--fg-3)] font-mono mt-0.5 mb-4">{capacity}</div>
      <DualRing size={120} thickness={11} innerThickness={4} gap={1.5}
        outer={{ pct: memPct, color: RING_COLOR }} inner={{ pct: heapPct, color: 'var(--info)' }}>
        <span className="text-[28px] font-semibold tabular-nums tracking-[-0.02em] leading-none" style={{ color: heroTint(memPct) }}>{sys}%</span>
        <span className="text-[10.5px] text-[var(--fg-3)] mt-1">System</span>
      </DualRing>
      <MeterFooter sub={<span className="text-[var(--info)]">Heap {heap}</span>} />
    </MeterShell>
  )
}

// ── Tier 2: bandwidth dual-ring meter (egress outer · ingress inner) ─────────
type BandwidthRingCardProps = {
  out: number
  inb: number
  link: number
  outHistory: number[]
  inHistory: number[]
  open: boolean
  onClick: () => void
}

export function BandwidthRingCard({ out, inb, link, outHistory, inHistory, open, onClick }: BandwidthRingCardProps) {
  // Per-ring auto-scale: each direction fills against its OWN recent peak (not the NIC link),
  // so up and down both breathe even when one is 10× the other. The link speed stays as
  // context text below. No value-driven colouring here: the rings hold their fixed tints.
  const outMax = niceMax(Math.max(out, ...outHistory))
  const inMax = niceMax(Math.max(inb, ...inHistory))
  const outPct = outMax > 0 ? Math.round((out / outMax) * 100) : 0
  const inPct = inMax > 0 ? Math.round((inb / inMax) * 100) : 0
  return (
    // Hero ring = outbound (the headline for a media server); the thin glued companion is
    // inbound, shown as an arc only: its value is in the hover title + history.
    <MeterShell open={open} onClick={onClick} title={`Up ${fmtMbps(out)} Mbps · Down ${fmtMbps(inb)} Mbps`}>
      <div className="flex items-center gap-2 text-[var(--fg-2)]">
        <Icon name="network" size={14} className="text-[var(--fg-3)]" />
        <span className="text-[13px] font-medium tracking-tight">Network</span>
      </div>
      <div className="text-[11px] text-[var(--fg-3)] font-mono mt-0.5 mb-4">of {link} Mbps uplink</div>
      <DualRing size={120} thickness={11} innerThickness={4} gap={1.5}
        outer={{ pct: outPct, color: RING_COLOR }} inner={{ pct: inPct, color: 'var(--info)' }}>
        <span className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] leading-none" style={{ color: 'var(--fg)' }}>{fmtMbps(out)}</span>
        <span className="text-[10.5px] text-[var(--fg-3)] mt-1">Mbps up</span>
      </DualRing>
      <MeterFooter sub={<span className="text-[var(--info)]">Down {fmtMbps(inb)} Mbps</span>} />
    </MeterShell>
  )
}
