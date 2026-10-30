import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import { errorMessage, useApi } from '@/lib/api'
import { broadcasts, ipcamera } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

// Form chrome shared by the new-stream and edit-stream modals. Sized apart from the
// shared `Field` kit (components/shared/form.tsx); don't mix the two in one modal.

const FIELD_BASE = 'w-full px-3.5 text-[14px] bg-[var(--bg-2)] border border-[var(--border)] rounded-[7px] outline-none text-[var(--fg)] placeholder:text-[var(--fg-3)] focus:border-[var(--accent)] transition-colors disabled:opacity-50'
export const INPUT_CLS = `${FIELD_BASE} h-10`
export const TEXTAREA_CLS = `${FIELD_BASE} py-2.5 resize-none leading-relaxed`

export function FieldLabel({ children, hint, optional, htmlFor }: {
  children: ReactNode; hint?: ReactNode; optional?: boolean; htmlFor?: string
}) {
  const inner = (
    <>
      <span className="text-[13px] font-medium text-[var(--fg)]">{children}</span>
      {optional && <span className="ml-1.5 text-[12px] font-normal text-[var(--fg-3)]">(optional)</span>}
      {hint && <span className="ml-1.5 text-[12px] font-normal text-[var(--fg-3)]">{hint}</span>}
    </>
  )
  return htmlFor
    ? <label htmlFor={htmlFor} className="mb-2 block">{inner}</label>
    : <div className="mb-2">{inner}</div>
}

export function TextField({ label, hint, optional, value, onChange, placeholder, disabled, mono, type = 'text', maxLength, autoFocus }: {
  label: ReactNode; hint?: ReactNode; optional?: boolean; value: string; onChange: (v: string) => void
  placeholder?: string; disabled?: boolean; mono?: boolean; maxLength?: number; autoFocus?: boolean
  type?: 'text' | 'password' | 'datetime-local'
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id} optional={optional} hint={hint}>{label}</FieldLabel>
      <input
        id={id}
        type={type}
        {...(autoFocus ? { 'data-autofocus': true } : {})} // the Modal's focus contract
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={cn(INPUT_CLS, mono && 'font-mono')}
      />
    </div>
  )
}

export function ToggleRow({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <span className="mt-px"><Switch checked={checked} onChange={onChange} aria-label={label} /></span>
      <span className="min-w-0">
        <span className="block text-[13.5px] text-[var(--fg)] leading-tight">{label}</span>
        {hint && <span className="block text-[12px] text-[var(--fg-3)] mt-0.5 leading-snug">{hint}</span>}
      </span>
    </label>
  )
}

// Camera host + ONVIF discovery. The server derives the RTSP URL from this address
// plus the credentials, so it is the only camera location the panel ever sends.
export function OnvifCameraHostField({ appName, value, onChange, disabled }: {
  appName: string | undefined; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  const id = useId()
  const [devices, setDevices] = useState<string[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const discover = async () => {
    if (!appName || discovering) return
    setDiscovering(true); setError(null)
    try {
      const found = await ipcamera(appName).onvifDevices()
      setDevices(found ?? [])
      if (!found?.length) setError('No ONVIF cameras found on the network.')
    } catch (err) {
      setError(errorMessage(err, 'Discovery failed.'))
    } finally {
      setDiscovering(false)
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-2 mb-2">
        <label htmlFor={id} className="text-[13px] font-medium text-[var(--fg)]">
          Camera host <span className="font-normal text-[var(--fg-3)]">(IP or ONVIF address)</span>
        </label>
        <Button variant="ghost" size="sm" type="button" onClick={discover} disabled={disabled || discovering}>
          <Icon name="search" size={11} className={discovering ? 'animate-spin' : undefined} />
          {discovering ? 'Discovering…' : 'Discover'}
        </Button>
      </div>
      <input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="192.168.1.50"
        disabled={disabled}
        className={cn(INPUT_CLS, 'font-mono')}
      />
      {error && <div className="mt-2 text-[12px] text-[var(--fg-3)]">{error}</div>}
      {devices.length > 0 && (
        <div className="mt-2 rounded-[7px] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {devices.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onChange(d)}
              disabled={disabled}
              className="w-full text-left px-3 py-2 text-[12.5px] font-mono text-[var(--fg-2)] hover:bg-[var(--bg-2)] disabled:opacity-50 flex items-center gap-2"
            >
              <Icon name="camera" size={12} className="text-[var(--fg-3)] shrink-0" />
              <span className="truncate">{d}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// NDI source by its exact name, which the server matches verbatim. Discovery runs on the server,
// so the list is what its network announces. Typing a name stands in for the legacy console's
// "Custom..." pick: a source that is not up yet can still be saved and started later.
export function NdiSourceField({ appName, value, onChange, disabled }: {
  appName: string | undefined; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  const id = useId()
  const discovery = useApi(
    signal => broadcasts(appName!).ndiSources(signal),
    { enabled: Boolean(appName), refetchKey: appName },
  )
  // A server without the endpoint routes this path to GET /broadcasts/{id}, so never trust the shape.
  const sources = Array.isArray(discovery.data) ? discovery.data : []

  return (
    <div>
      <div className="flex items-end justify-between gap-2 mb-2">
        <label htmlFor={id} className="text-[13px] font-medium text-[var(--fg)]">
          NDI source <span className="font-normal text-[var(--fg-3)]">(exact name)</span>
        </label>
        <Button variant="ghost" size="sm" type="button" onClick={discovery.refresh} disabled={disabled || discovery.isFetching}>
          <Icon name="refresh" size={11} className={discovery.isFetching ? 'animate-spin' : undefined} />
          {discovery.isFetching ? 'Searching…' : 'Reload'}
        </Button>
      </div>
      <input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="MACHINE (Source)"
        disabled={disabled}
        className={cn(INPUT_CLS, 'font-mono')}
      />
      {discovery.error ? (
        <div className="mt-2 text-[12px] text-[var(--danger)]">
          Could not load NDI sources. {errorMessage(discovery.error, 'The server gave no reason.')}
        </div>
      ) : discovery.data !== null && sources.length === 0 && (
        <div className="mt-2 text-[12px] text-[var(--fg-3)] leading-snug">
          The server sees no NDI sources on its network. If you expect some, check that the NDI runtime is
          installed on the server. You can still type a source name and start it once it appears.
        </div>
      )}
      {sources.length > 0 && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-[7px] border border-[var(--border)] divide-y divide-[var(--border)]">
          {sources.map(src => {
            const picked = src === value.trim()
            return (
              <button
                key={src}
                type="button"
                onClick={() => onChange(src)}
                disabled={disabled}
                aria-pressed={picked}
                className={cn(
                  'w-full text-left px-3 py-2 text-[12.5px] font-mono hover:bg-[var(--bg-2)] disabled:opacity-50 flex items-center gap-2',
                  picked ? 'text-[var(--fg)] bg-[var(--bg-2)]' : 'text-[var(--fg-2)]',
                )}
              >
                <Icon name="network" size={12} className="text-[var(--fg-3)] shrink-0" />
                <span className="truncate">{src}</span>
                {picked && <Icon name="check" size={12} className="ml-auto shrink-0 text-[var(--accent)]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
