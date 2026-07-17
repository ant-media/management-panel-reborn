import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { useAnchoredPosition } from '@/components/shared/use-anchored-position'
import { usePlayJwtEnabled } from '@/features/apps/use-app-settings'
import { isVodReady, vodDisplayName, type VoD } from '@/features/vods/types'
import { useVodSuggestions } from '@/features/vods/use-vods'
import { vodPlaylistUrl } from '@/features/vods/url-builder'
import { VodPickerModal } from '@/features/vods/vod-picker-modal'
import { fmtDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { newDraftItem, type PlaylistDraftItem } from './draft'
import { INPUT_CLS } from './fields'

// Playlist item list editor: URL rows with as-you-type VoD suggestions, drag
// reorder, and (via the picker modal) bulk add from the app's VoD library.
// Controlled; shared by the new-stream and edit-stream modals.

type Props = {
  appName: string | undefined
  items: PlaylistDraftItem[]
  onChange: Dispatch<SetStateAction<PlaylistDraftItem[]>>
  disabled?: boolean
  // Host modal must go non-dismissible while the picker is up, or one Escape
  // closes the whole stack (both modals listen on document).
  onModalToggle?: (open: boolean) => void
}

export function PlaylistItemsEditor({ appName, items, onChange, disabled, onModalToggle }: Props) {
  const playJwt = usePlayJwtEnabled(appName)
  const [dragKey, setDragKey] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const togglePicker = (open: boolean) => { setPickerOpen(open); onModalToggle?.(open) }

  const add = () => {
    const fresh = newDraftItem() // outside the updater: updaters must stay pure
    onChange(arr => [...arr, fresh])
  }

  const pickInto = async (key: number, vod: VoD) => {
    if (!appName) return
    const url = await vodPlaylistUrl(appName, vod, playJwt)
    if (url) onChange(arr => arr.map(it => it.key === key ? { ...it, streamUrl: url, name: vodDisplayName(vod) } : it))
  }

  const addPicked = async (vods: VoD[]) => {
    if (!appName) return
    const urls = await Promise.all(vods.map(v => vodPlaylistUrl(appName, v, playJwt)))
    const fresh = vods.flatMap((v, i) => urls[i] ? [newDraftItem({ streamUrl: urls[i], name: vodDisplayName(v) })] : [])
    onChange(arr => [...arr, ...fresh])
    togglePicker(false)
  }

  const pickerButton = (
    <Button variant="outline" size="sm" onClick={() => togglePicker(true)} disabled={disabled || !appName}>
      <Icon name="video" size={12} className="text-[var(--accent)]" /> Open VoD picker
    </Button>
  )

  const picker = pickerOpen && appName && (
    <VodPickerModal appName={appName} onAdd={addPicked} onClose={() => togglePicker(false)} />
  )

  const dragOver = (overKey: number) => {
    if (dragKey === null || dragKey === overKey) return
    onChange(arr => {
      const from = arr.findIndex(it => it.key === dragKey)
      const to = arr.findIndex(it => it.key === overKey)
      if (from < 0 || to < 0) return arr
      const next = [...arr]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-[var(--border)] rounded-[9px] py-6 flex flex-col items-center gap-3">
        <div className="text-[12.5px] text-[var(--fg-3)]">No playlist items yet</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={add} disabled={disabled}>
            <Icon name="plus" size={12} /> Add item
          </Button>
          {pickerButton}
        </div>
        {picker}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div
          key={it.key}
          onDragOver={e => { if (dragKey !== null) { e.preventDefault(); dragOver(it.key) } }}
          onDrop={e => e.preventDefault()} // suppress the snap-back animation
          className={cn('flex items-center gap-2', dragKey === it.key && 'opacity-50')}
        >
          <button
            type="button"
            // Drag from the handle only; a static draggable avoids the mousedown-to-draggable race.
            draggable={!disabled}
            // Firefox refuses to start a drag without payload data.
            onDragStart={e => { setDragKey(it.key); e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move' }}
            onDragEnd={() => setDragKey(null)}
            disabled={disabled}
            aria-label={`Reorder item ${i + 1}`}
            title="Drag to reorder"
            className="w-5 h-10 shrink-0 flex items-center justify-center text-[var(--fg-3)] cursor-grab active:cursor-grabbing disabled:opacity-40"
          >
            <Icon name="grip" size={14} />
          </button>
          <span className="w-5 shrink-0 text-[12px] font-mono text-[var(--fg-3)] tabular-nums text-right">{i + 1}.</span>
          <VodSuggestInput
            value={it.streamUrl}
            appName={appName}
            disabled={disabled}
            ariaLabel={`Playlist item ${i + 1}`}
            // Typing over the URL drops the picked VoD's name, but keeps seekTimeInMs/type:
            // neither has a UI, so replacing the row would silently zero a stored offset.
            onChange={v => onChange(arr => arr.map(x => x.key === it.key ? { ...x, streamUrl: v, name: undefined } : x))}
            onPick={vod => void pickInto(it.key, vod)}
          />
          <button
            type="button"
            onClick={() => onChange(arr => arr.filter(x => x.key !== it.key))}
            disabled={disabled}
            aria-label={`Remove item ${i + 1}`}
            className="w-10 h-10 shrink-0 rounded-[7px] text-[var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[var(--danger)] disabled:opacity-40 flex items-center justify-center"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={add} disabled={disabled}>
          <Icon name="plus" size={11} /> Add item
        </Button>
        {pickerButton}
      </div>
      {picker}
    </div>
  )
}

const DEBOUNCE_MS = 250
// Skip the VoD search once the value is clearly a URL (pasted or picked): searching
// the server for "https://…" would only ever render a noisy no-match row.
const URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i

const SUGGEST_ROW = 'w-full px-2.5 py-1.5 text-left text-[12px] flex items-center gap-2'
const HINT_ROW = 'px-2.5 py-1.5 text-[12px] text-[var(--fg-3)]'

function VodSuggestInput({ value, appName, disabled, ariaLabel, onChange, onPick }: {
  value: string
  appName: string | undefined
  disabled?: boolean
  ariaLabel: string
  onChange: (v: string) => void
  onPick: (vod: VoD) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('') // debounced copy of value
  const [active, setActive] = useState(-1)
  const timer = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const pos = useAnchoredPosition({ open, triggerRef: inputRef, panelRef, align: 'left', matchWidth: true })
  const { vods: found, isLoading, error } = useVodSuggestions(appName, query, open)
  const suggestions = (found ?? []).filter(isVodReady)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (!inputRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const handleChange = (v: string) => {
    onChange(v)
    window.clearTimeout(timer.current)
    if (!v.trim() || URL_RE.test(v.trim())) { setOpen(false); return }
    timer.current = window.setTimeout(() => { setQuery(v); setActive(-1); setOpen(true) }, DEBOUNCE_MS)
  }

  const pick = (vod: VoD) => {
    setOpen(false)
    setActive(-1)
    onPick(vod)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // Swallow it before the Modal's document listener: close only the dropdown.
      if (open) { e.stopPropagation(); setOpen(false) }
      return
    }
    if (e.key === 'Tab') { setOpen(false); return }
    if (!open) {
      // ArrowDown reopens the last search (the legacy console made you retype).
      if (e.key === 'ArrowDown' && value.trim() && !URL_RE.test(value.trim())) {
        e.preventDefault()
        setQuery(value); setActive(-1); setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, -1)) }
    else if (e.key === 'Enter') {
      // Always eat Enter while open: the input lives inside the create form.
      e.preventDefault()
      if (active >= 0 && suggestions[active]) pick(suggestions[active])
      else setOpen(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="https://example.com/video.mp4"
        disabled={disabled}
        className={cn(INPUT_CLS, 'font-mono')}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            width: pos?.width,
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="z-50 bg-[var(--card)] border border-[var(--border)] rounded-[7px] shadow-xl py-1"
        >
          {isLoading ? (
            <div className={HINT_ROW}>Searching…</div>
          ) : error ? (
            <div className={HINT_ROW}>VoD search failed. You can still paste a URL.</div>
          ) : suggestions.length === 0 ? (
            <div className={HINT_ROW}>No VoDs match "{query.trim()}". Paste a URL instead.</div>
          ) : (
            suggestions.map((v, i) => (
              <button
                key={v.vodId}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={e => e.preventDefault()} // keep the input focused through the click
                onClick={() => pick(v)}
                onMouseEnter={() => setActive(i)}
                className={cn(SUGGEST_ROW, i === active && 'bg-[var(--bg-2)]')}
              >
                <span className="truncate font-medium text-[var(--fg)]">{vodDisplayName(v)}</span>
                <span className="font-mono text-[11px] text-[var(--fg-3)] truncate">{v.vodId}</span>
                <span className="ml-auto pl-2 font-mono text-[11px] text-[var(--fg-3)] tabular-nums shrink-0">
                  {v.duration ? fmtDuration(v.duration) : ''}
                </span>
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
