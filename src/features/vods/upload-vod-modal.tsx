import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'
import { Field, FormError } from '@/components/shared/form'
import { cn } from '@/lib/utils'
import { resultError } from '@/lib/api'
import { fmtBytes } from '@/lib/format'
import { useVodActions } from './use-vod-actions'

type Props = {
  appName: string | undefined
  open: boolean
  onClose: () => void
  onUploaded?: (name: string) => void
}

export function UploadVodModal({ appName, open, onClose, onUploaded }: Props) {
  const actions = useVodActions(appName)
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Clear state each time the modal opens so a previous pick doesn't linger.
  useEffect(() => {
    if (open) { setFile(null); setName(''); setBusy(false); setError(null); setDragOver(false) }
  }, [open])

  const pick = (f: File | null) => {
    if (!f) return
    setFile(f)
    setName(f.name)
    setError(null)
  }

  const submit = async () => {
    if (!file || busy) return
    setBusy(true); setError(null)
    const res = await actions.upload(file, name)
    setBusy(false)
    if (res.success) { onUploaded?.(name.trim() || file.name); onClose() }
    else setError(resultError(res, 'Upload failed. The server gave no reason. Check the server logs.'))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title="Upload VoD"
      description="Add a video file to this application's VoD library."
      width="sm"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" onClick={submit} disabled={!file || busy}>
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={e => pick(e.target.files?.[0] ?? null)} />

        <button
          type="button"
          data-autofocus
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0] ?? null) }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed px-4 py-7 text-center transition-colors',
            dragOver ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border-strong)] hover:bg-[var(--bg-2)]',
          )}
        >
          <Icon name="upload" size={18} className="text-[var(--fg-3)]" />
          {file ? (
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-[var(--fg)] truncate max-w-[360px]">{file.name}</div>
              <div className="text-[11px] text-[var(--fg-3)] font-mono mt-0.5">{fmtBytes(file.size)}</div>
            </div>
          ) : (
            <div className="text-[12px] text-[var(--fg-3)]">Click to choose a file, or drop it here</div>
          )}
        </button>

        {file && <Field label="Display name" value={name} onChange={setName} disabled={busy} />}

        {error && <FormError>{error}</FormError>}
      </div>
    </Modal>
  )
}
