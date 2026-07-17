import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { CopyChip } from '@/components/shared/copy-chip'
import { cn } from '@/lib/utils'
import { AppStreamsTab } from '@/features/streams/app-streams-tab'
import { AppVodsTab } from '@/features/vods/app-vods-tab'
import { DiscardChangesModal } from '@/components/shared/discard-changes-modal'
import { useUnsavedGuard } from '@/lib/use-unsaved-guard'
import { ConfirmDeleteModal } from './confirm-delete-modal'
import { SettingsTab } from './settings-tab'
import { useApplications } from './use-applications'

const TABS = {
  streams:   { label: 'Live Streams', phase: '8' },
  vod:       { label: 'VoD',          phase: '10' },
  settings:  { label: 'Settings',     phase: '11' },
  analytics: { label: 'Analytics',    phase: 'TBD' },
} as const

type Tab = keyof typeof TABS
const TAB_ORDER: Tab[] = ['streams', 'vod', 'settings', 'analytics']

export function AppDetailPage() {
  const { name = '' } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { apps } = useApplications()
  const [tab, setTab] = useState<Tab>('streams')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [pendingTab, setPendingTab] = useState<Tab | null>(null)

  // Guard route navigation + browser unload while settings has unsaved edits.
  const blocker = useUnsavedGuard(settingsDirty)

  const app = apps?.find(a => a.name === name) ?? null
  const exists = apps == null ? null : apps.some(a => a.name === name)

  // Tab switches are local state (not navigations), so gate them here too.
  const requestTab = (next: Tab) => {
    if (next === tab) return
    if (tab === 'settings' && settingsDirty) { setPendingTab(next); return }
    setTab(next)
  }
  const guardOpen = pendingTab !== null || blocker.state === 'blocked'
  const discardAndLeave = () => {
    if (pendingTab !== null) { setSettingsDirty(false); setTab(pendingTab); setPendingTab(null) }
    else blocker.proceed?.()
  }
  const keepEditing = () => {
    setPendingTab(null)
    blocker.reset?.()
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-2.5 pt-4 pb-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-x-3 gap-y-1 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="box" size={16} className="text-[var(--fg-3)] shrink-0" aria-hidden />
            <h1 className="text-[20px] font-medium tracking-tight text-[var(--fg)] truncate">{name}</h1>
            <CopyChip value={name} showValue={false} />
          </div>
          {app && (
            <span className="text-[12.5px] text-[var(--fg-3)] tabular-nums">
              {app.liveStreamCount} live · {app.vodCount} VoD
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="dangerOutline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={exists === false}
            title={exists === false ? 'This application no longer exists' : 'Delete this application'}
          >
            <Icon name="trash" size={12} /> Delete app
          </Button>
        </div>
      </div>

      {exists === false ? (
        <MissingApp name={name} onBack={() => void navigate('/apps')} />
      ) : (
        <>
          <div role="tablist" aria-label="Application sections" className="px-2.5 border-b border-[var(--border)] flex items-center">
            {TAB_ORDER.map(k => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => requestTab(k)}
                className={cn('relative h-10 px-3 text-[13px] flex items-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                  tab === k ? 'text-[var(--fg)]' : 'text-[var(--fg-3)] hover:text-[var(--fg-2)]')}
              >
                {TABS[k].label}
                {tab === k && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Keyed like SettingsTab below: switching app must not carry the open drawer, the
                search box or the page offset over into a different app's streams. */}
            {tab === 'streams' ? <AppStreamsTab key={name} appName={name} onGoToSettings={() => requestTab('settings')} />
              : tab === 'vod' ? <AppVodsTab appName={name} />
              : tab === 'settings' ? <SettingsTab key={name} name={name} onDirtyChange={setSettingsDirty} />
              : <TabStub tab={tab} />}
          </div>
        </>
      )}

      {deleteOpen && (
        <ConfirmDeleteModal
          appName={name}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => { setSettingsDirty(false); void navigate('/apps') }}
        />
      )}

      <DiscardChangesModal
        open={guardOpen}
        onDiscard={discardAndLeave}
        onCancel={keepEditing}
        message="You have unsaved settings changes. Leaving now will discard them."
      />
    </div>
  )
}

function TabStub({ tab }: { tab: Tab }) {
  const active = TABS[tab]
  return (
    <div className="h-full flex items-center justify-center min-h-[300px]">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-2)] flex items-center justify-center mb-3">
          <Icon name="box" size={20} className="text-[var(--fg-3)]" aria-hidden />
        </div>
        <div className="text-[14px] font-medium text-[var(--fg)] mb-1">{active.label}</div>
        <div className="text-[12px] text-[var(--fg-3)]">Stub, lands in Phase {active.phase}</div>
      </div>
    </div>
  )
}

function MissingApp({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-2)] flex items-center justify-center mb-3">
          <Icon name="info" size={20} className="text-[var(--fg-3)]" />
        </div>
        <div className="text-[14px] font-medium text-[var(--fg)] mb-1">Application not found</div>
        <div className="text-[12px] text-[var(--fg-3)] mb-4">No application named <code className="font-mono">{name}</code> exists on this server.</div>
        <Button variant="outline" size="md" onClick={onBack}>Back to applications</Button>
      </div>
    </div>
  )
}
