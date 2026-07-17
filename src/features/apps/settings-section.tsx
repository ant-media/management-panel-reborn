import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'
import { InfoDot } from '@/components/shared/info-dot'
import { cn } from '@/lib/utils'
import { SettingFieldRow } from './settings-field'
import type { FieldStatus, SettingField, SettingSection } from './settings-schema'
import type { AppSettings } from './use-app-settings'

type Props = {
  section: SettingSection
  visibleFields: SettingField[]      // already filtered by search / diff / showWhen
  draft: AppSettings
  dirtyKeys: Set<string>
  statuses: Record<string, FieldStatus>
  open: boolean
  onToggle: () => void
  onField: (key: string, value: unknown) => void
  onResetField: (key: string) => void
  onResetSection: () => void
}

export function SettingsSectionCard({
  section, visibleFields, draft, dirtyKeys, statuses, open, onToggle, onField, onResetField, onResetSection,
}: Props) {
  const sectionDirty = section.fields.reduce((n, f) => n + (dirtyKeys.has(f.key) ? 1 : 0), 0)
  // Collapsing a card hides its rows, so the header carries the flag; otherwise the toolbar's
  // warning count points at nothing. Count lives in the toolbar; here it's presence only.
  const hasWarning = section.fields.some(f => statuses[f.key]?.warning)

  return (
    <div className={cn('rounded-[8px] border transition-colors',
      open ? 'border-[var(--border-strong)] bg-[var(--bg-2)]'
        : 'border-[var(--border)] bg-transparent hover:bg-[var(--bg-2)] hover:border-[var(--border-strong)]')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} className="text-[var(--fg-3)] shrink-0" />
        <span className={cn('w-7 h-7 rounded-[6px] inline-flex items-center justify-center shrink-0',
          open ? 'bg-[var(--bg)] text-[var(--fg-2)]' : 'bg-[var(--bg-2)] text-[var(--fg-3)]')}>
          <Icon name={section.icon} size={13} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-medium text-[var(--fg)]">{section.title}</span>
            {section.info && <InfoDot text={section.info} />}
          </div>
          {section.desc && <div className="text-[11.5px] text-[var(--fg-3)] mt-0.5">{section.desc}</div>}
        </div>
        {hasWarning && (
          <span title="Contains a setting that needs attention" className="shrink-0 text-[var(--warn)] inline-flex">
            <Icon name="alert" size={13} />
          </span>
        )}
        {sectionDirty > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono text-[var(--warn)] shrink-0 px-1.5 py-0.5 rounded bg-[var(--warn-bg)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)]" />
            {sectionDirty}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-3.5 pt-2 pb-3 flex flex-col">
          {renderRows(visibleFields, draft, dirtyKeys, statuses, onField, onResetField)}
          <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-end">
            <button type="button" onClick={onResetSection} className="text-[11px] text-[var(--fg-3)] hover:text-[var(--fg)] inline-flex items-center gap-1">
              <Icon name="refresh" size={11} /> Reset section to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Consecutive reveal:true fields collapse into one indented rail (the look of a
// toggle's children), matching the reference's nested-reveal block.
function renderRows(
  fields: SettingField[],
  draft: AppSettings,
  dirtyKeys: Set<string>,
  statuses: Record<string, FieldStatus>,
  onField: (key: string, value: unknown) => void,
  onResetField: (key: string) => void,
): ReactNode[] {
  const out: ReactNode[] = []
  let run: SettingField[] = []

  const row = (f: SettingField) => (
    <SettingFieldRow
      key={f.key}
      field={f}
      value={draft[f.key]}
      dirty={dirtyKeys.has(f.key)}
      status={statuses[f.key]}
      onChange={v => onField(f.key, v)}
      onReset={() => onResetField(f.key)}
    />
  )
  const flush = () => {
    if (run.length === 0) return
    out.push(
      <div key={`reveal-${run[0].key}`} className="ml-7 pl-3 border-l-2 border-[var(--accent-border)] flex flex-col">
        {run.map(row)}
      </div>,
    )
    run = []
  }

  for (const f of fields) {
    if (f.reveal) { run.push(f); continue }
    flush()
    out.push(row(f))
  }
  flush()
  return out
}
