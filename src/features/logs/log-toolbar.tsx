import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import { SearchInput } from '@/components/shared/search-input'
import { Toolbar, ToolbarActions, ToolbarLeading } from '@/components/shared/toolbar'
import { cn } from '@/lib/utils'
import { BUCKET_TONE, LEVEL_BUCKETS, type LogBucket } from './parse'
import type { LogSource } from './log-sources'

const INTERVAL_OPTIONS: [value: number, label: string][] = [
  [0, 'Off'], [2000, '2s'], [5000, '5s'], [10000, '10s'],
]
const CAP_OPTIONS = [500, 1000, 1500, 5000, 10000]

type Props = {
  sources: LogSource[]
  sourceId: string
  onSource: (id: string) => void
  search: string
  onSearch: (v: string) => void
  counts: Record<LogBucket, number>
  levels: LogBucket[]
  onToggleLevel: (b: LogBucket) => void
  intervalMs: number
  onInterval: (ms: number) => void
  paused: boolean
  onPause: () => void
  follow: boolean
  onFollow: (v: boolean) => void
  wrap: boolean
  onWrap: (v: boolean) => void
  cap: number
  onCap: (n: number) => void
}

export function LogToolbar(p: Props) {
  return (
    <Toolbar className="px-5 py-3 border-b border-[var(--border)]">
      <ToolbarLeading>
        <Select
          icon="logs"
          ariaLabel="Log source"
          value={p.sourceId}
          onChange={p.onSource}
          options={p.sources.map(s => [s.id, s.label])}
        />
        <SearchInput value={p.search} onChange={p.onSearch} placeholder="Search loaded logs…" ariaLabel="Search logs" />
        <div className="flex items-center">
          {LEVEL_BUCKETS.map(lvl => {
            const on = p.levels.includes(lvl)
            return (
              <button
                key={lvl}
                onClick={() => p.onToggleLevel(lvl)}
                aria-pressed={on}
                className={cn(
                  'h-8 px-2 text-[11px] font-mono inline-flex items-center gap-1.5 border first:rounded-l-[6px] last:rounded-r-[6px] -ml-px first:ml-0 transition-colors border-[var(--border)]',
                  on ? 'bg-[var(--bg-2)] text-[var(--fg)]' : 'bg-transparent text-[var(--fg-3)] hover:bg-[var(--bg-2)]',
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? BUCKET_TONE[lvl] : 'var(--fg-3)' }} />
                {lvl} <span className="tabular-nums text-[10px] text-[var(--fg-3)]">{p.counts[lvl]}</span>
              </button>
            )
          })}
        </div>
      </ToolbarLeading>

      <ToolbarActions>
        <Select
          icon="refresh"
          ariaLabel="Auto-refresh interval"
          value={String(p.intervalMs)}
          onChange={v => p.onInterval(Number(v))}
          options={INTERVAL_OPTIONS.map(([v, l]) => [String(v), l])}
        />
        <Button onClick={p.onPause}>
          <Icon name={p.paused ? 'play' : 'pause'} size={12} /> {p.paused ? 'Resume' : 'Pause'}
        </Button>
        <ToggleLabel checked={p.follow} onChange={p.onFollow}>Follow</ToggleLabel>
        <ToggleLabel checked={p.wrap} onChange={p.onWrap}>Wrap</ToggleLabel>
        <Select
          ariaLabel="Buffer size"
          title="Lines kept in memory"
          value={String(p.cap)}
          onChange={v => p.onCap(Number(v))}
          options={CAP_OPTIONS.map(n => [String(n), `${n.toLocaleString()} lines`])}
        />
      </ToolbarActions>
    </Toolbar>
  )
}

function ToggleLabel({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-[11.5px] text-[var(--fg-2)] cursor-pointer select-none">
      <Switch checked={checked} onChange={onChange} aria-label={String(children)} /> {children}
    </label>
  )
}

function Select({ value, onChange, options, icon, ariaLabel, title }: {
  value: string
  onChange: (v: string) => void
  options: [value: string, label: string][]
  icon?: Parameters<typeof Icon>[0]['name']
  ariaLabel: string
  title?: string
}) {
  return (
    <div className="relative">
      {icon && <Icon name={icon} size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)] pointer-events-none" />}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={ariaLabel}
        title={title}
        className={cn(
          'h-8 pr-7 text-[12px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] rounded-[6px] outline-none text-[var(--fg)] appearance-none cursor-pointer',
          icon ? 'pl-7' : 'pl-2.5',
        )}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Icon name="chevron-down" size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-3)] pointer-events-none" />
    </div>
  )
}
