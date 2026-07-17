import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Icon, type IconName } from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import { LineChart } from '@/components/shared/line-chart'
import { Pill, type PillTone } from '@/components/shared/pill'
import { ProtocolBadge } from '@/components/shared/protocol-badge'
import { DualRing, Ring } from '@/components/shared/ring'
import { Sparkline } from '@/components/shared/sparkline'
import { MOCKS_ENABLED, useApi } from '@/lib/api'
import { system } from '@/lib/api/endpoints'

const ICON_NAMES: IconName[] = [
  'dashboard', 'box', 'settings', 'cluster', 'logs', 'support', 'search', 'plus', 'x',
  'chevron-down', 'chevron-right', 'chevrons-right', 'chevron-left', 'arrow-right',
  'more-h', 'more-v', 'play', 'stop', 'record', 'eye', 'eye-off', 'video', 'cpu',
  'memory', 'database', 'network', 'clock', 'hard-drive', 'gpu', 'users', 'zap', 'rss',
  'bell', 'sun', 'moon', 'menu', 'filter', 'download', 'trash', 'copy', 'code', 'info',
  'maximize', 'cmd', 'cog', 'shield', 'terminal', 'pause', 'refresh', 'upload', 'power',
  'edit', 'file', 'link', 'camera', 'list', 'check',
]

const PILL_TONES: PillTone[] = ['ok', 'warn', 'err', 'live', 'info', 'neutral']

const SPARK_DATA = [3, 5, 4, 7, 9, 6, 8, 11, 10, 13, 12, 15, 14, 17, 16, 19]
const CHART_SERIES = [
  { data: [12, 18, 15, 22, 28, 24, 31, 27, 35, 30, 38, 34], color: 'var(--accent)' },
  { data: [8, 10, 12, 14, 13, 16, 18, 17, 20, 22, 21, 24],  color: 'var(--info)' },
]

export function UiSinkPage() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [switchOn, setSwitchOn] = useState(true)
  const [checked, setChecked] = useState(true)

  const toggleTheme = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    setDark(next)
  }

  return (
    <main className="min-h-full px-6 py-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[var(--fg-3)]">/ui-sink · primitives reference</p>
          <h1 className="text-2xl font-semibold tracking-tight">UI kitchen sink</h1>
        </div>
        <Button variant="outline" size="md" onClick={toggleTheme}>
          <Icon name={dark ? 'sun' : 'moon'} size={14} />
          {dark ? 'Light' : 'Dark'}
        </Button>
      </header>

      <Section title="Icons">
        <div className="flex flex-wrap gap-3 text-[var(--fg-2)]">
          {ICON_NAMES.map(name => (
            <div key={name} className="flex flex-col items-center gap-1 w-16">
              <Icon name={name} size={18} />
              <span className="text-[9.5px] text-[var(--fg-3)] font-mono truncate w-full text-center">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="dangerOutline">Delete</Button>
          <Button variant="primary" size="md">Primary md</Button>
          <Button variant="outline" size="md"><Icon name="plus" size={13} /> New</Button>
          <Button variant="ghost" size="icon"><Icon name="more-h" size={14} /></Button>
          <Button variant="outline" size="iconSm"><Icon name="x" size={11} /></Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Pills">
        <div className="flex flex-wrap items-center gap-2">
          {PILL_TONES.map(tone => (
            <Pill key={tone} tone={tone}>{tone}</Pill>
          ))}
          {PILL_TONES.map(tone => (
            <Pill key={`${tone}-dot`} tone={tone} dot>{tone}</Pill>
          ))}
          <Pill tone="live" dot interactive>HOVER ME</Pill>
        </div>
      </Section>

      <Section title="Switch / Checkbox">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-[var(--fg-2)]">
            <Switch checked={switchOn} onChange={setSwitchOn} />
            Switch ({switchOn ? 'on' : 'off'})
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--fg-2)]">
            <Checkbox checked={checked} onChange={setChecked} />
            Checkbox ({checked ? 'checked' : 'unchecked'})
          </label>
        </div>
      </Section>

      <Section title="Rings">
        <div className="flex flex-wrap gap-8 items-end">
          {[42, 76, 92].map(pct => (
            <Ring key={pct} pct={pct}>
              <span className="text-2xl font-semibold tabular-nums">{pct}</span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--fg-3)]">CPU</span>
            </Ring>
          ))}
          <DualRing
            outer={{ pct: 64, color: 'var(--accent)' }}
            inner={{ pct: 38, color: 'var(--info)' }}
          >
            <span className="text-lg font-semibold tabular-nums">64/38</span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--fg-3)]">Dual</span>
          </DualRing>
        </div>
      </Section>

      <Section title="Sparkline">
        <div className="grid grid-cols-3 gap-4">
          <SparkCell label="Default"><Sparkline data={SPARK_DATA} /></SparkCell>
          <SparkCell label="Filled accent"><Sparkline data={SPARK_DATA} stroke="var(--accent)" fill="var(--accent)" /></SparkCell>
          <SparkCell label="Full width"><Sparkline data={SPARK_DATA} full stroke="var(--info)" fill="var(--info)" /></SparkCell>
        </div>
      </Section>

      <Section title="Line chart">
        <div className="p-4">
          <LineChart series={CHART_SERIES} height={180} />
        </div>
      </Section>

      <Section title="Protocol badges">
        <div className="flex flex-wrap items-center gap-2">
          {['WebRTC', 'RTMP', 'SRT', 'HLS', 'RTSP', 'MPEG-TS'].map(t => (
            <ProtocolBadge key={t} type={t} />
          ))}
        </div>
      </Section>

      <Section title="Data layer (useApi)">
        <DataLayerDemo />
      </Section>
    </main>
  )
}

type CpuStatus = {
  processCPULoad: number
  systemCPULoad: number
  processCPUTime: number
}

function DataLayerDemo() {
  const { data, error, isLoading, isFetching, refresh } = useApi(
    signal => system.cpu(signal) as Promise<CpuStatus>,
    { pollMs: 2000 },
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] text-[var(--fg-3)] font-mono">
        <span>GET /rest/v2/cpu-status</span>
        <span aria-hidden>·</span>
        <span>poll 2s</span>
        <span aria-hidden>·</span>
        <span>mocks: {MOCKS_ENABLED ? 'on' : 'off'}</span>
        {isFetching && <Pill tone="info" dot>fetching</Pill>}
        <Button variant="outline" size="md" onClick={refresh} className="ml-auto">
          <Icon name="refresh" size={12} /> Refresh
        </Button>
      </div>

      {isLoading && <div className="text-sm text-[var(--fg-3)]">loading…</div>}

      {error && (
        <div className="text-sm text-[var(--danger)] font-mono">
          {error.name}: {error.message}
        </div>
      )}

      {data && (
        <pre className="text-[11.5px] font-mono leading-relaxed bg-[var(--bg-2)] rounded-md p-3 text-[var(--fg-2)] overflow-x-auto">
{JSON.stringify(data, null, 2)}
        </pre>
      )}

      {!MOCKS_ENABLED && (
        <p className="text-[11px] text-[var(--fg-3)]">
          Enable mocks with <code className="font-mono">VITE_USE_MOCKS=true</code> (in <code className="font-mono">.env.local</code>) to see canned responses.
        </p>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-[11px] uppercase tracking-widest text-[var(--fg-3)] mb-4">{title}</h2>
      {children}
    </Card>
  )
}

function SparkCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-2)] rounded-md p-3 flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wider text-[var(--fg-3)]">{label}</span>
      <div className="flex items-center justify-center min-h-[28px]">{children}</div>
    </div>
  )
}
