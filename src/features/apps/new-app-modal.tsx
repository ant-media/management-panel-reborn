import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'
import { Field, FormError } from '@/components/shared/form'
import { fmtBytes } from '@/lib/format'
import { resultError } from '@/lib/api'
import { APP_NAME_RE, useApplications, type Result } from './use-applications'

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: (name: string) => void
}

export function NewAppModal({ open, onClose, onCreated }: Props) {
  const { apps, create } = useApplications()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [warFile, setWarFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setName(''); setWarFile(null); setBusy(false); setServerError(null) }
  }, [open])

  const trimmed = name.trim()
  const existing = (apps ?? []).some(a => a.name.toLowerCase() === trimmed.toLowerCase())
  const validShape = APP_NAME_RE.test(trimmed)
  const validation = !trimmed ? null
    : !validShape ? 'Letters, numbers, hyphens, underscores. Up to 32 characters.'
    : existing ? 'An application with this name already exists.'
    : null
  const canSubmit = Boolean(trimmed) && !validation && !busy

  const pickWar = (f: File | null) => {
    if (f && !f.name.toLowerCase().endsWith('.war')) { setServerError('Please choose a .war file.'); return }
    setWarFile(f)
    setServerError(null)
  }

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true); setServerError(null)
    const res: Result = await create(trimmed, warFile)
    setBusy(false)
    if (res.success) { onCreated?.(trimmed); onClose() }
    else setServerError(resultError(res, 'Could not create the application. The server gave no reason. Check the server logs.'))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title="New application"
      description={<>Creates a new live-streaming endpoint under <code className="font-mono">/&lt;name&gt;/</code></>}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" onClick={submit} disabled={!canSubmit}>
            {busy ? (warFile ? 'Installing…' : 'Creating…') : 'Create application'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={e => { e.preventDefault(); void submit() }}
        className="flex flex-col gap-3"
      >
        <Field
          label="Application name"
          required
          autoFocus
          value={name}
          onChange={v => setName(v.replace(/[^A-Za-z0-9_-]/g, ''))}
          placeholder="e.g. live, conference, MyApp"
          disabled={busy}
          maxLength={32}
          hint="Letters, numbers, hyphens, underscores. Cannot be renamed later."
          error={validation}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-[var(--fg-2)]">
            Custom application <span className="font-normal text-[var(--fg-3)]">(optional)</span>
          </span>
          <input ref={fileRef} type="file" accept=".war" className="hidden" onChange={e => pickWar(e.target.files?.[0] ?? null)} />

          {warFile ? (
            <div className="flex items-center gap-2 rounded-[7px] border border-[var(--border-strong)] bg-[var(--bg-2)] px-3 py-2">
              <Icon name="box" size={14} className="shrink-0 text-[var(--fg-3)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-[var(--fg)] truncate">{warFile.name}</div>
                <div className="text-[10.5px] text-[var(--fg-3)] font-mono">{fmtBytes(warFile.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => pickWar(null)}
                disabled={busy}
                aria-label="Remove file"
                className="shrink-0 text-[var(--fg-3)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-[7px] border border-[var(--border-strong)] px-3 py-2.5 text-[11.5px] text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-2)] disabled:opacity-50"
            >
              <Icon name="upload" size={14} /> Choose a .war file
            </button>
          )}

          <div className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--fg-3)]">
            <Icon name="info" size={12} className="mt-[1px] shrink-0" />
            <span>
              Leave empty to create a standard application. To deploy your own build, upload its packaged{' '}
              <code className="font-mono text-[var(--fg-2)]">.war</code> file; the server installs it under this name.
            </span>
          </div>
        </div>

        {serverError && <FormError>{serverError}</FormError>}
      </form>
    </Modal>
  )
}
