import { useId } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { InfoDot } from '@/components/shared/info-dot'
import { cn } from '@/lib/utils'
import { RENDITION_HEIGHTS, asString, parseFieldValue, type FieldStatus, type Rendition, type SettingField } from './settings-schema'

const FULL_WIDTH = new Set<FieldRow['field']['type']>(['renditions', 'textarea'])

type FieldRow = {
  field: SettingField
  value: unknown
  dirty: boolean
  status?: FieldStatus
  onChange: (v: unknown) => void
  onReset: () => void
}

export function SettingFieldRow({ field, value, dirty, status, onChange, onReset }: FieldRow) {
  const id = useId()
  const shown = parseFieldValue(field, value).value
  const fullWidth = FULL_WIDTH.has(field.type)
  const isBool = field.type === 'bool'
  // Group controls (radio, renditions) aren't a single labelable element; they
  // carry their own group label instead. Bool rows toggle on a whole-row click, so
  // we drop the label association there too (avoids a double-toggle on label clicks).
  const labelTargetId = field.type === 'radio' || field.type === 'renditions' || isBool ? undefined : id

  const labelRow = (
    <div className="flex items-center gap-1.5 min-w-0">
      <label htmlFor={labelTargetId} className={cn('text-[12.5px] text-[var(--fg)]', isBool ? 'cursor-pointer' : 'cursor-default')} title={field.key}>{field.label}</label>
      {field.info && <span onClick={stop}><InfoDot text={field.info} /></span>}
      {dirty && (
        <button
          type="button"
          onClick={e => { stop(e); onReset() }}
          title={`Default: ${JSON.stringify(field.def)} (click to reset)`}
          className="inline-flex items-center gap-1 text-[10.5px] text-[var(--warn)] hover:underline"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)]" /> unsaved
        </button>
      )}
    </div>
  )

  // `data-field` is the scroll anchor the warnings menu and the blocker banner jump to.
  if (fullWidth) {
    return (
      <div data-field={field.key} className="py-2 px-2 -mx-2 rounded-[6px] hover:bg-[var(--bg)] transition-colors">
        <div className="flex items-center gap-1.5 mb-1.5">
          {labelRow}
          {field.hint && <span className="ml-auto text-[10.5px] text-[var(--fg-3)] text-right">{field.hint}</span>}
        </div>
        {field.type === 'renditions'
          ? <RenditionEditor value={shown as Rendition[]} onChange={onChange} />
          : <TextareaControl id={id} field={field} value={asString(shown)} onChange={onChange} status={status} />}
        <StatusNote status={status} />
      </div>
    )
  }

  // Bool rows toggle on a click anywhere in the row; interactive children stopPropagation
  // (the switch, reset button, info dot) so they each fire exactly once.
  return (
    <div
      data-field={field.key}
      className={cn('py-2 px-2 -mx-2 rounded-[6px] hover:bg-[var(--bg)] transition-colors', isBool && 'cursor-pointer')}
      onClick={isBool ? () => onChange(shown !== true) : undefined}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {labelRow}
          {field.hint && <div className="text-[11px] text-[var(--fg-3)] mt-0.5">{field.hint}</div>}
        </div>
        <div className="shrink-0 flex justify-end" onClick={isBool ? stop : undefined}>
          <Control id={id} field={field} value={value} shown={shown} onChange={onChange} />
        </div>
      </div>
      <StatusNote status={status} />
    </div>
  )
}

// Keep a click from bubbling to a parent row handler (used by bool whole-row toggling).
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

// The single renderer for a field's status, so every control type shows one, not just
// textareas. Inert, but it must swallow the click or a bool row would toggle under it.
function StatusNote({ status }: { status?: FieldStatus }) {
  const { error, warning } = status ?? {}
  if (!error && !warning) return null
  return (
    <div
      onClick={stop}
      className={cn('mt-1 flex items-start gap-1 text-[10.5px]', error ? 'text-[var(--danger)]' : 'text-[var(--warn)]')}
    >
      <Icon name="alert" size={10} className="mt-px shrink-0" />
      {error ?? warning}
    </div>
  )
}

function Control({ id, field, value, shown, onChange }: { id: string; field: SettingField; value: unknown; shown: unknown; onChange: (v: unknown) => void }) {
  switch (field.type) {
    case 'bool':
      return <Switch id={id} checked={shown === true} onChange={onChange} />
    case 'num':
      return <NumberStepper id={id} field={field} value={value} shown={shown as number} onChange={onChange} />
    case 'text':
      return (
        <input
          id={id}
          type="text"
          value={asString(shown)}
          onChange={e => onChange(e.target.value)}
          className="h-8 w-56 px-2 text-[12.5px] font-mono bg-[var(--card)] border border-[var(--border)] focus:border-[var(--accent)] rounded-[6px] outline-none text-[var(--fg)]"
        />
      )
    case 'select':
      return (
        <select
          id={id}
          value={asString(shown)}
          onChange={e => onChange(e.target.value)}
          className="h-8 px-2 text-[12.5px] bg-[var(--card)] border border-[var(--border)] focus:border-[var(--accent)] rounded-[6px] outline-none text-[var(--fg)] cursor-pointer"
        >
          {field.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div role="radiogroup" aria-label={field.label} className="inline-flex bg-[var(--card)] border border-[var(--border)] rounded-[6px] p-0.5">
          {field.options?.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={asString(shown) === v}
              onClick={() => onChange(v)}
              className={cn('h-7 px-2.5 text-[11.5px] rounded-[4px] transition-colors',
                asString(shown) === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--fg-2)] hover:bg-[var(--bg-2)]')}
            >
              {l}
            </button>
          ))}
        </div>
      )
    default:
      return null
  }
}

// Number fields preserve their wire type: hlsListSize/hlsTime are strings ("15")
// in the POJO, webRTCFrameRate is a number. Display is the parsed value (`shown`);
// emit inspects the RAW value so a string field keeps emitting strings.
function NumberStepper({ id, field, value, shown, onChange }: { id: string; field: SettingField; value: unknown; shown: number; onChange: (v: unknown) => void }) {
  const asStr = typeof value === 'string' || (value == null && typeof field.def === 'string')
  const emit = (next: number) => onChange(asStr ? String(next) : next)
  const stepBtn = 'w-7 text-[var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)] flex items-center justify-center'
  return (
    <div className="inline-flex h-8 items-stretch bg-[var(--card)] border border-[var(--border)] focus-within:border-[var(--accent)] rounded-[6px] overflow-hidden">
      <button type="button" onClick={() => emit(shown - 1)} className={cn(stepBtn, 'border-r border-[var(--border)]')}>−</button>
      <input
        id={id}
        type="number"
        value={shown}
        onChange={e => emit(Number(e.target.value))}
        className="w-14 px-1 text-[12.5px] font-mono tabular-nums bg-transparent outline-none text-[var(--fg)] text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => emit(shown + 1)} className={cn(stepBtn, 'border-l border-[var(--border)]')}>+</button>
    </div>
  )
}

// Tints its border to match the status; the message itself is rendered once by StatusNote.
function TextareaControl({ id, field, value, onChange, status }: { id: string; field: SettingField; value: string; onChange: (v: unknown) => void; status?: FieldStatus }) {
  return (
    <div className="flex items-stretch gap-1.5">
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder={field.minLen ? `At least ${field.minLen} characters` : undefined}
        className={cn('flex-1 px-2 py-1.5 text-[12px] font-mono bg-[var(--card)] border rounded-[6px] outline-none text-[var(--fg)] resize-y',
          status?.error ? 'border-[var(--danger)]' : status?.warning ? 'border-[var(--warn)]' : 'border-[var(--border)] focus:border-[var(--accent)]')}
      />
      {field.generate != null && (
        <Button variant="outline" size="md" onClick={() => onChange(randomSecret(field.generate!))}>Generate</Button>
      )}
    </div>
  )
}

function RenditionEditor({ value, onChange }: { value: Rendition[]; onChange: (v: Rendition[]) => void }) {
  const update = (i: number, patch: Partial<Rendition>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const add = () => onChange([...value, { height: 720, videoBitrate: 1500, audioBitrate: 128 }])
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))
  const cell = 'h-8 px-2 text-[12px] bg-[var(--card)] border border-[var(--border)] focus:border-[var(--accent)] rounded-[6px] outline-none text-[var(--fg)]'
  const num = cn(cell, 'font-mono tabular-nums text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')
  return (
    <div className="w-full flex flex-col gap-1.5">
      <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1.5 text-[10px] uppercase tracking-wider text-[var(--fg-3)] px-0.5">
        <div>Resolution</div><div>Video (kbps)</div><div>Audio (kbps)</div><div />
      </div>
      {value.length === 0 && <div className="text-[11.5px] text-[var(--fg-3)] py-1">No renditions, the source is passed through unchanged.</div>}
      {value.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1.5 items-center">
          <select value={row.height} onChange={e => update(i, { height: Number(e.target.value) })} className={cell}>
            {!RENDITION_HEIGHTS.includes(row.height) && <option value={row.height}>{row.height}p</option>}
            {RENDITION_HEIGHTS.map(h => <option key={h} value={h}>{h}p</option>)}
          </select>
          <input type="number" value={row.videoBitrate} onChange={e => update(i, { videoBitrate: Number(e.target.value) })} className={num} />
          <input type="number" value={row.audioBitrate} onChange={e => update(i, { audioBitrate: Number(e.target.value) })} className={num} />
          <button
            type="button"
            onClick={() => remove(i)}
            title="Remove"
            className="w-6 h-8 rounded-[5px] text-[var(--fg-3)] hover:bg-[var(--bg-3)] hover:text-[var(--danger)] flex items-center justify-center"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start h-7 px-2 text-[11.5px] text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--bg-3)] rounded-[5px] inline-flex items-center gap-1"
      >
        <Icon name="plus" size={11} /> Add rendition
      </button>
    </div>
  )
}

function randomSecret(len: number): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}
