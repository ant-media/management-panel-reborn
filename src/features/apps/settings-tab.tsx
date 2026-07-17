import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { errorMessage, resultMessage } from '@/lib/api'
import { useApi } from '@/lib/api/use-api'
import { server } from '@/lib/api/endpoints'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/shared/pill'
import { SearchInput } from '@/components/shared/search-input'
import { Toolbar, ToolbarLeading, ToolbarActions } from '@/components/shared/toolbar'
import { LoadErrorBanner } from '@/components/shared/load-error-banner'
import { ToastBanner } from '@/components/shared/toast'
import { useToast } from '@/lib/use-toast'
import { useStoredState } from '@/lib/localStorage'
import { useIsNarrow } from '@/lib/use-is-narrow'
import { copyToClipboard } from '@/lib/clipboard'
import { downloadFile } from '@/lib/download'
import { parseJsonText } from '@/lib/json'
import { cn } from '@/lib/utils'
import { ImportSettingsModal, type ImportPreview } from './import-settings-modal'
import { serializeSettings } from './settings-io'
import { canonValue, fieldStatus, getSettingsSchema, type FieldStatus, type RuleContext, type SettingField, type SettingSection } from './settings-schema'
import { SettingsSectionCard } from './settings-section'
import { WarningsMenu, type FlaggedField } from './settings-warnings'
import { saveAppSettings, useAppSettings, type AppSettings } from './use-app-settings'

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function SettingsTab({ name, onDirtyChange }: { name: string; onDirtyChange?: (dirty: boolean) => void }) {
  const { data, error, isLoading, refresh } = useAppSettings(name)
  // Pass `data` through the swap seam (ignored today). Memoised on `data` so the
  // identity stays stable once the seam starts deriving sections from the response.
  const schema = useMemo(() => getSettingsSchema(data), [data])
  const { toast, flash, dismiss } = useToast()
  // Below this width the form + JSON pane can't sit side by side; JSON overlays instead.
  const narrow = useIsNarrow(1024)

  // baseline = last loaded/saved server state; draft = live edits. Settings aren't
  // polled, so re-syncing both on every `data` change only fires on load/refresh.
  const [baseline, setBaseline] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<AppSettings | null>(null)
  useEffect(() => { if (data) { setBaseline(data); setDraft(data) } }, [data])

  const [search, setSearch] = useState('')
  const [diffOnly, setDiffOnly] = useState(false)
  const [nonDefaultOnly, setNonDefaultOnly] = useState(false)
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({})
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonDraft, setJsonDraft] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [hintDismissed, setHintDismissed] = useStoredState('settings_hint_dismissed', false)

  // Schema keys compare by displayed value (canonValue): the wire sends absent/null
  // for untouched fields while controls emit typed defaults, and raw eq would flag
  // that as a phantom "unsaved". Keys outside the schema keep raw eq.
  const fieldByKey = useMemo(() => new Map(schema.flatMap(s => s.fields).map(f => [f.key, f])), [schema])
  const canonEq = useCallback((key: string, a: unknown, b: unknown): boolean => {
    const f = fieldByKey.get(key)
    if (f) return eq(canonValue(f, a), canonValue(f, b))
    // Non-schema keys: absent and explicit null are wire-identical (a missing key
    // and a null both deserialize to the POJO default), so never flag one against the other.
    return (a == null && b == null) || eq(a, b)
  }, [fieldByKey])

  const dirtyKeys = useMemo(() => {
    const s = new Set<string>()
    if (!draft || !baseline) return s
    for (const k of new Set([...Object.keys(draft), ...Object.keys(baseline)])) {
      if (!canonEq(k, draft[k], baseline[k])) s.add(k)
    }
    return s
  }, [draft, baseline, canonEq])
  const dirtyCount = dirtyKeys.size

  // Edition is server-wide and immutable, so a one-shot probe (no poll). Only this tab consumes
  // it; null while it's in flight or if it failed, which rules read as "stay quiet".
  const edition = useApi(s => server.enterpriseEdition(s))
  const ctx = useMemo<RuleContext>(() => ({ enterprise: edition.data ? edition.data.success : null }), [edition.data])

  // One pass over the schema: the per-field status the rows render, split by severity. Errors
  // block the save (a config that would lock the app/streams out is refused, frontend-side,
  // the backend isn't touched); warnings only inform.
  const { statuses, blockers, warnings } = useMemo(() => {
    const statuses: Record<string, FieldStatus> = {}
    const blockers: FlaggedField[] = []
    const warnings: FlaggedField[] = []
    if (draft) for (const sec of schema) for (const f of sec.fields) {
      const st = fieldStatus(f, draft, ctx)
      const msg = st.error ?? st.warning
      if (!msg) continue
      statuses[f.key] = st
      ;(st.error ? blockers : warnings).push({ key: f.key, label: f.label, sectionId: sec.id, sectionTitle: sec.title, msg })
    }
    return { statuses, blockers, warnings }
  }, [schema, draft, ctx])
  const hasBlockers = blockers.length > 0

  // Report dirtiness up so the page can guard tab-switch / navigation away.
  useEffect(() => { onDirtyChange?.(dirtyCount > 0) }, [dirtyCount, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const json = useMemo(() => (draft ? JSON.stringify(draft, null, 2) : ''), [draft])

  // Pin a section open (idempotent). Called when a value changes so the card the user is
  // editing survives a search clear (search-open is render-only, never written to state).
  const pinOpen = (id: string) => setOpenSec(o => (o[id] ? o : { ...o, [id]: true }))

  // Form edits also resync the JSON drawer (jsonDraft → null shows derived json).
  const setField = (key: string, value: unknown) => {
    setDraft(d => (d ? { ...d, [key]: value } : d))
    setJsonDraft(null); setJsonError(null)
    const sec = schema.find(s => s.fields.some(f => f.key === key))
    if (sec) pinOpen(sec.id)
  }
  const resetField = (key: string, def: unknown) => setField(key, def)
  const resetSection = (section: SettingSection) => {
    setDraft(d => {
      if (!d) return d
      const next = { ...d }
      for (const f of section.fields) next[f.key] = f.def
      return next
    })
    setJsonDraft(null); setJsonError(null)
    pinOpen(section.id)
  }

  // The JSON editor survives invalid input: keep the raw text, flag the parse
  // error, and DON'T touch draft until it parses to an object again.
  const onJsonChange = (text: string) => {
    setJsonDraft(text)
    try {
      const parsed = parseJsonText(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object')
      setJsonError(null)
      setDraft(parsed as AppSettings)
    } catch (e) {
      setJsonError(errorMessage(e, 'That JSON could not be applied.'))
    }
  }

  // Open a section (clearing filters that might hide the offending field) so the user can fix it.
  // The row only mounts on the render this triggers, so the scroll waits for the effect below.
  // `n` makes a repeat click on the same field re-fire it.
  const [focus, setFocus] = useState<{ key: string; n: number } | null>(null)
  const jumpTo = (sectionId: string, fieldKey: string) => {
    setSearch(''); setDiffOnly(false); setNonDefaultOnly(false)
    setOpenSec(o => ({ ...o, [sectionId]: true }))
    setFocus(f => ({ key: fieldKey, n: (f?.n ?? 0) + 1 }))
  }
  useEffect(() => {
    if (!focus) return
    document.querySelector(`[data-field="${focus.key}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focus])

  const save = async () => {
    if (!draft || saving || jsonError || hasBlockers) return
    setSaving(true)
    const res = await saveAppSettings(name, draft)
    setSaving(false)
    // On success, draft IS the saved server state, no refetch (settings aren't
    // polled and the POST returns only {success}); a refetch here would clobber any
    // edit the user starts before it lands. On reject we keep draft + baseline
    // untouched so the edits survive and the user can fix and retry.
    if (res.success) { setBaseline(draft); flash('ok', 'Settings saved.') }
    else {
      const why = resultMessage(res)
      flash('err', why ? `Save failed: ${why}` : 'Save failed. Your changes are kept, so you can retry.')
    }
  }
  const discard = () => { setDraft(baseline); setJsonDraft(null); setJsonError(null) }

  // Import replaces the draft (same contract as a JSON-drawer paste). Values are
  // never coerced: a type misfit warns via fieldStatus and ships as-is on save.
  // The file's appName was stripped by settings-io; re-inject ours.
  const withIdentity = (imported: AppSettings): AppSettings =>
    baseline?.appName != null ? { ...imported, appName: baseline.appName } : imported

  const previewImport = (imported: AppSettings): ImportPreview => {
    const applied = withIdentity(imported)
    const p: ImportPreview = { changed: 0, missing: 0, hidden: 0 }
    if (!draft) return p
    for (const k of new Set([...Object.keys(applied), ...Object.keys(draft)])) {
      if (canonEq(k, applied[k], draft[k])) continue
      p.changed++
      if (!(k in applied)) p.missing++
      if (!fieldByKey.has(k)) p.hidden++
    }
    return p
  }

  const applyImport = (imported: AppSettings, fileName: string) => {
    const { changed } = previewImport(imported)
    setDraft(withIdentity(imported))
    setJsonDraft(null); setJsonError(null)
    setDiffOnly(true)
    flash('ok', `Imported ${changed} changed setting${changed === 1 ? '' : 's'} from ${fileName}. Review and save.`)
  }

  const exportSettings = () => {
    if (!draft || jsonError) return
    downloadFile(`${name}-settings.json`, serializeSettings(draft, name, Date.now()))
    flash('ok', 'Settings exported.')
  }

  if (error && !draft) {
    return <div className="p-2.5"><LoadErrorBanner entity="settings" error={error} onRetry={refresh} /></div>
  }
  if (!draft || isLoading) return <SettingsSkeleton />

  const q = search.toLowerCase()
  // A search force-opens its matching sections, but only at render; it never writes
  // into openSec, so clearing the box restores the manual expand/collapse state.
  const searching = q !== ''
  const isVisible = (f: SettingField, section: SettingSection): boolean => {
    const isDirty = dirtyKeys.has(f.key)
    // A reveal field whose toggle is off is hidden, UNLESS it's unsaved and we're
    // filtering to unsaved, so a counted change is never invisible/un-resettable.
    if (f.showWhen && !f.showWhen(draft) && !(diffOnly && isDirty)) return false
    if (diffOnly && !isDirty) return false
    if (nonDefaultOnly && eq(canonValue(f, draft[f.key]), canonValue(f, f.def))) return false
    if (q && !(f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || section.title.toLowerCase().includes(q))) return false
    return true
  }
  const sections = schema
    .map(s => ({ section: s, fields: s.fields.filter(f => isVisible(f, s)) }))
    .filter(s => s.fields.length > 0)

  const allOpen = schema.every(s => searching || openSec[s.id])
  const toggleAll = () => setOpenSec(allOpen ? {} : Object.fromEntries(schema.map(s => [s.id, true])))

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <Toolbar className="px-2.5 py-3 border-b border-[var(--border)]">
        <ToolbarLeading className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Find a setting…" ariaLabel="Find a setting" className="flex-1 min-w-[150px] max-w-[300px]" />
          <FilterToggle active={diffOnly} onClick={() => setDiffOnly(v => !v)} count={dirtyCount || undefined}>Only unsaved</FilterToggle>
          <FilterToggle active={nonDefaultOnly} onClick={() => setNonDefaultOnly(v => !v)}>Different from defaults</FilterToggle>
        </ToolbarLeading>
        <ToolbarActions>
          <WarningsMenu warnings={warnings} onJump={jumpTo} />
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={12} /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportSettings} disabled={!!jsonError} title={jsonError ? 'Fix the JSON error first' : 'Download these settings as JSON'}>
            <Icon name="download" size={12} /> Export
          </Button>
          <Button variant={jsonOpen ? 'primary' : 'outline'} size="sm" onClick={() => setJsonOpen(v => !v)}>
            <Icon name="code" size={12} /> {jsonOpen ? 'Hide' : 'Show'} JSON
          </Button>
          <Button variant="outline" size="sm" onClick={toggleAll} title="Toggle all sections">
            <Icon name="chevron-down" size={12} /> {allOpen ? 'Collapse' : 'Expand'} all
          </Button>
        </ToolbarActions>
      </Toolbar>

      {/* Save result / errors live here, outside the scroll area so a failed save is
          always visible even when the user is down at the save bar. */}
      {toast && <div className="px-2.5 pt-3"><ToastBanner toast={toast} onDismiss={dismiss} /></div>}

      {/* Security safety net: a config that would lock the app/streams out can't be saved. */}
      {hasBlockers && (
        <div className="px-2.5 pt-3">
          <div className="rounded-[8px] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--danger)]">
              <Icon name="shield" size={13} className="shrink-0" />
              {blockers.length} security setting{blockers.length > 1 ? 's' : ''} would block access, fix {blockers.length > 1 ? 'these' : 'this'} before saving:
            </div>
            <ul className="mt-1.5 flex flex-col gap-1 pl-[21px]">
              {blockers.map(b => (
                <li key={b.key} className="text-[11.5px] text-[var(--fg-2)]">
                  <button type="button" onClick={() => jumpTo(b.sectionId, b.key)} className="text-left hover:underline">
                    <span className="font-medium text-[var(--fg)]">{b.sectionTitle} › {b.label}</span>: {b.msg}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="relative flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[760px] mx-auto px-2.5 pt-4 pb-24">
            {!hintDismissed && (
              <div className="mb-3 flex items-start gap-2 text-[11.5px] text-[var(--fg-3)] px-2.5 py-2 rounded-[6px] bg-[var(--bg-2)]">
                <Icon name="info" size={12} className="mt-[2px]" />
                <div className="flex-1">Click a section to edit. Changes are batched, nothing applies until you press Save.</div>
                <button onClick={() => setHintDismissed(true)} aria-label="Dismiss" className="text-[var(--fg-3)] hover:text-[var(--fg)]"><Icon name="x" size={12} /></button>
              </div>
            )}

            {sections.length === 0 ? (
              <div className="text-center py-16 text-[12.5px] text-[var(--fg-3)]">
                {diffOnly ? 'No unsaved changes.' : nonDefaultOnly ? 'Every setting is at its default.' : 'No settings match your search.'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sections.map(({ section, fields }) => (
                  <SettingsSectionCard
                    key={section.id}
                    section={section}
                    visibleFields={fields}
                    draft={draft}
                    dirtyKeys={dirtyKeys}
                    statuses={statuses}
                    open={searching || !!openSec[section.id]}
                    onToggle={() => setOpenSec(o => ({ ...o, [section.id]: !o[section.id] }))}
                    onField={setField}
                    onResetField={key => resetField(key, section.fields.find(f => f.key === key)?.def)}
                    onResetSection={() => resetSection(section)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {jsonOpen && !narrow && (
          <JsonDrawer
            className="w-[460px] shrink-0 border-l border-[var(--border)]"
            text={jsonDraft ?? json}
            error={jsonError}
            onChange={onJsonChange}
            onCopy={() => void copyToClipboard(jsonDraft ?? json)}
            onClose={() => setJsonOpen(false)}
          />
        )}

        {jsonOpen && narrow && (
          <div className="absolute inset-0 z-40 flex">
            <button type="button" aria-label="Close JSON editor" onClick={() => setJsonOpen(false)} className="flex-1 bg-black/40" />
            <JsonDrawer
              className="w-full max-w-[440px] h-full border-l border-[var(--border)] shadow-2xl"
              text={jsonDraft ?? json}
              error={jsonError}
              onChange={onJsonChange}
              onCopy={() => void copyToClipboard(jsonDraft ?? json)}
              onClose={() => setJsonOpen(false)}
            />
          </div>
        )}
      </div>

      <ImportSettingsModal
        appName={name}
        open={importOpen}
        dirtyCount={dirtyCount}
        preview={previewImport}
        onApply={applyImport}
        onClose={() => setImportOpen(false)}
      />

      {/* Sticky save bar */}
      {dirtyCount > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3 py-2 bg-[var(--fg)] text-[var(--bg)] rounded-[10px] shadow-2xl">
          <span className="text-[12px] font-medium">{dirtyCount} unsaved change{dirtyCount > 1 ? 's' : ''}</span>
          <button onClick={discard} disabled={saving} className="text-[11.5px] opacity-70 hover:opacity-100 disabled:opacity-40">Discard</button>
          <button onClick={save} disabled={saving || !!jsonError || hasBlockers} title={jsonError ? 'Fix the JSON error before saving' : hasBlockers ? 'Fix the flagged security settings before saving' : undefined} className="h-7 px-3 bg-[var(--accent)] text-white rounded-[6px] text-[12px] font-medium hover:brightness-110 disabled:opacity-60 inline-flex items-center gap-1.5">
            {saving && <Icon name="refresh" size={12} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}

function FilterToggle({ active, onClick, count, children }: { active: boolean; onClick: () => void; count?: number; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('h-8 px-3 text-[12px] rounded-[6px] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0',
        active ? 'bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-border)]' : 'border border-[var(--border)] text-[var(--fg-2)] hover:bg-[var(--bg-2)]')}
    >
      <Icon name="filter" size={12} /> {children}
      {count != null && (
        <span className={cn('ml-0.5 px-1 rounded text-[10px] font-mono tabular-nums', active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-3)] text-[var(--fg-2)]')}>{count}</span>
      )}
    </button>
  )
}

// Fixed row height + top padding shared by textarea/gutter/band; a fractional line-height would
// drift them out of step. wrap="off" keeps one logical line per visual row.
const LINE_H = 18
const PAD_Y = 12

function JsonDrawer({ className, text, error, onChange, onCopy, onClose }: {
  className?: string; text: string; error: string | null; onChange: (t: string) => void; onCopy: () => void; onClose: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  const [activeLine, setActiveLine] = useState(1)
  const activeRef = useRef(1)   // activeLine mirror for sync(), avoids a render on scroll

  const lineCount = useMemo(() => (text ? text.split('\n').length : 1), [text])
  const digits = Math.max(2, String(lineCount).length)
  const gutterW = `calc(${digits}ch + 20px)`

  // Lock gutter + band to the textarea scroll, imperatively (no render on scroll).
  const sync = () => {
    const ta = taRef.current
    if (!ta) return
    const line = Math.min(activeRef.current, lineCount)   // clamp: an edit may shrink past the caret
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`
    if (bandRef.current) bandRef.current.style.top = `${PAD_Y + (line - 1) * LINE_H - ta.scrollTop}px`
  }
  // Wired to keyUp/click/select below: in Chrome no single one fires for caret-via-arrows,
  // click-to-place, and drag-select alike.
  const trackCaret = () => {
    const ta = taRef.current
    if (!ta) return
    const line = ta.value.slice(0, ta.selectionStart).split('\n').length
    if (line !== activeRef.current) { activeRef.current = line; setActiveLine(line) }
    sync()
  }
  useLayoutEffect(sync)   // re-sync after renders (caret moved, or text changed)

  const nums = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => (
      <div key={i} style={{ height: LINE_H, lineHeight: `${LINE_H}px` }}
        className={cn('pr-2.5 text-right tabular-nums transition-colors', i + 1 === Math.min(activeLine, lineCount) ? 'text-[var(--fg)]' : 'text-[var(--fg-3)]')}>
        {i + 1}
      </div>
    )),
    [lineCount, activeLine],
  )

  return (
    <aside className={cn('bg-[var(--bg-2)] flex flex-col min-h-0', className)}>
      <div className="px-3 h-9 flex items-center justify-between border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Icon name="code" size={12} className="text-[var(--fg-3)]" />
          <span className="text-[11.5px] font-medium text-[var(--fg)]">appSettings.json</span>
          {error ? <Pill tone="err" dot>invalid</Pill> : <Pill tone="ok" dot>synced</Pill>}
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="iconSm" title="Copy" onClick={onCopy}><Icon name="copy" size={12} /></Button>
          <Button variant="ghost" size="iconSm" title="Close" onClick={onClose}><Icon name="x" size={12} /></Button>
        </div>
      </div>
      {/* Layers, back to front: active-line band → gutter numbers → the transparent textarea. */}
      <div className="relative flex-1 min-h-0 overflow-hidden focus-within:bg-[var(--bg)] transition-colors">
        <div ref={bandRef} aria-hidden style={{ height: LINE_H, top: PAD_Y }}
          className="pointer-events-none absolute left-0 right-0 bg-[var(--bg-3)]" />
        <div aria-hidden style={{ width: gutterW }}
          className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden border-r border-[var(--border)] select-none">
          <div ref={gutterRef} style={{ paddingTop: PAD_Y }} className="font-mono text-[11px] will-change-transform">
            {nums}
          </div>
        </div>
        <textarea
          ref={taRef}
          value={text}
          wrap="off"
          onChange={e => { onChange(e.target.value); trackCaret() }}
          onScroll={sync}
          onSelect={trackCaret}
          onKeyUp={trackCaret}
          onClick={trackCaret}
          spellCheck={false}
          style={{ paddingTop: PAD_Y, paddingBottom: PAD_Y, paddingRight: 12, paddingLeft: gutterW, lineHeight: `${LINE_H}px` }}
          className={cn('absolute inset-0 text-[11.5px] font-mono bg-transparent text-[var(--fg-2)] outline-none resize-none border-0 overflow-auto',
            error && 'text-[var(--danger)]')}
        />
      </div>
      <div className={cn('px-3 py-2 border-t border-[var(--border)] flex items-start gap-2 text-[10.5px]',
        error ? 'text-[var(--danger)] bg-[var(--danger-bg)]' : 'text-[var(--fg-3)]')}>
        <Icon name={error ? 'info' : 'edit'} size={11} className="mt-px shrink-0" />
        <span className="flex-1">{error ? <>Parse error: {error}</> : <>Edit directly. Changes round-trip with the form; save with the bar below.</>}</span>
      </div>
    </aside>
  )
}

function SettingsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[760px] mx-auto px-2.5 pt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[60px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-2)] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
