import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { CodeChip } from '@/components/shared/code-chip'
import { FormError } from '@/components/shared/form'
import { cn } from '@/lib/utils'
import { ApiError, errorMessage, type Result } from '@/lib/api'
import { broadcasts } from '@/lib/api/endpoints'
import { parseImport } from './stream-io'
import type { Broadcast } from './types'

// Import a JSON export of stream definitions. Flow: pick + parse a file, POST it,
// and if the server reports duplicates (400) offer to skip or override them, then
// show a per-outcome summary. The three phases (pick / conflict / summary) are
// derived from state rather than a discriminated enum to keep the reset trivial.

type Props = {
  appName: string
  open: boolean
  onClose: () => void
  onImported: () => void
}

type Summary = { created: number; skipped: number; overridden: number; failed: number }

function tally(results: Result[]): Summary {
  const s: Summary = { created: 0, skipped: 0, overridden: 0, failed: 0 }
  for (const r of results) {
    if (r.message === 'created') s.created++
    else if (r.message === 'skipped') s.skipped++
    else if (r.message === 'overridden') s.overridden++
    else s.failed++
  }
  return s
}

// The 400 body is the backend Result JSON (raw text on the real transport); fall
// back gracefully if it's a plain string or unparseable.
function conflictMessage(body: unknown): string {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { message?: string }
      const msg = parsed?.message?.trim()
      if (msg) return msg
    } catch { /* not JSON, use the raw text below */ }
    if (body.trim()) return body.trim()
  }
  return 'Some of these streams already exist.'
}

export function ImportStreamsModal({ appName, open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [streams, setStreams] = useState<Partial<Broadcast>[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  const reset = () => {
    setStreams(null); setFileName(''); setBusy(false)
    setError(null); setConflict(null); setSummary(null)
  }
  const close = () => { if (!busy) { reset(); onClose() } }

  const pickFile = async (file: File | null) => {
    if (!file) return
    setError(null); setConflict(null); setSummary(null)
    try {
      const parsed = parseImport(await file.text())
      if (parsed.length === 0) { setStreams(null); setError('No streams found in this file.'); return }
      setStreams(parsed); setFileName(file.name)
    } catch (e) {
      setStreams(null)
      setError(errorMessage(e, 'Could not read file.'))
    }
  }

  const submit = async (onDuplicate?: 'skip' | 'overwrite') => {
    if (!streams) return
    setBusy(true); setError(null); setConflict(null)
    try {
      const results = await broadcasts(appName).createMany(streams, { onDuplicate })
      setSummary(tally(results))
      onImported()
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) setConflict(conflictMessage(e.body))
      else setError(errorMessage(e, 'Import failed. The server gave no reason. Check the server logs.'))
    } finally {
      setBusy(false)
    }
  }

  const footer = summary ? (
    <Button variant="primary" size="md" onClick={close} data-autofocus>Done</Button>
  ) : conflict ? (
    <>
      <Button variant="ghost" size="md" onClick={close} disabled={busy}>Cancel</Button>
      <Button variant="outline" size="md" onClick={() => void submit('skip')} disabled={busy}>Skip existing</Button>
      <Button variant="dangerOutline" size="md" onClick={() => void submit('overwrite')} disabled={busy}>Override existing</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" size="md" onClick={close} disabled={busy}>Cancel</Button>
      <Button variant="primary" size="md" onClick={() => void submit()} disabled={busy || !streams} {...(busy || !streams ? {} : { 'data-autofocus': true })}>
        {busy ? 'Importing…' : 'Import'}
      </Button>
    </>
  )

  return (
    <Modal open={open} onClose={close} dismissible={!busy} title="Import streams" width="sm" icon="upload" footer={footer}>
      {summary ? (
        <SummaryView summary={summary} />
      ) : conflict ? (
        <div className="flex flex-col gap-2 text-[12.5px] text-[var(--fg-2)]">
          <p>{conflict}</p>
          <p><span className="font-medium text-[var(--fg)]">Skip</span> keeps the existing streams. <span className="font-medium text-[var(--fg)]">Override</span> replaces them (a live stream is stopped and recreated).</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={e => { void pickFile(e.target.files?.[0] ?? null); e.target.value = '' }}
          />
          <Button variant="outline" size="md" onClick={() => fileRef.current?.click()} disabled={busy}>
            Choose JSON file…
          </Button>
          {streams && (
            <p className="text-[12.5px] text-[var(--fg-2)]">
              <span className="font-semibold text-[var(--fg)]">{streams.length}</span> stream{streams.length === 1 ? '' : 's'} in <CodeChip>{fileName}</CodeChip>
            </p>
          )}
          {error && <FormError>{error}</FormError>}
        </div>
      )}
    </Modal>
  )
}

function SummaryView({ summary }: { summary: Summary }) {
  const rows: [string, number][] = [
    ['Created', summary.created],
    ['Overridden', summary.overridden],
    ['Skipped', summary.skipped],
    ['Failed', summary.failed],
  ]
  return (
    <div className="flex flex-col gap-1.5 text-[12.5px]">
      {rows.map(([label, n]) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-[var(--fg-3)]">{label}</span>
          <span className={cn('tabular-nums font-medium', label === 'Failed' && n > 0 ? 'text-[var(--danger)]' : 'text-[var(--fg)]')}>{n}</span>
        </div>
      ))}
    </div>
  )
}
