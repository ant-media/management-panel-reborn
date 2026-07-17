import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { CodeChip } from '@/components/shared/code-chip'
import { FormError } from '@/components/shared/form'
import { errorMessage } from '@/lib/api'
import { parseSettingsImport } from './settings-io'
import type { AppSettings } from './use-app-settings'

// Pick + preview an app settings JSON file. Applying only replaces the draft;
// the review happens in the form (dirty marks) and nothing hits the server
// until Save. On a parse error the file content is shown alongside the message.

const MAX_FILE_BYTES = 2 * 1024 * 1024
const RAW_PREVIEW_CHARS = 20_000

// hidden = changed keys with no form row (outside the schema); only the JSON view shows them.
export type ImportPreview = { changed: number; missing: number; hidden: number }

type Props = {
  appName: string
  open: boolean
  dirtyCount: number
  preview: (imported: AppSettings) => ImportPreview
  onApply: (imported: AppSettings, fileName: string) => void
  onClose: () => void
}

type Picked = { settings: AppSettings; sourceApp?: string; fileName: string; preview: ImportPreview }

export function ImportSettingsModal({ appName, open, dirtyCount, preview, onApply, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawText, setRawText] = useState<string | null>(null)

  const reset = () => { setPicked(null); setError(null); setRawText(null) }
  const close = () => { reset(); onClose() }

  const pickFile = async (file: File | null) => {
    if (!file) return
    reset()
    if (file.size > MAX_FILE_BYTES) { setError('File is too large to be an app settings export.'); return }
    let text: string
    try {
      text = await file.text()
    } catch {
      setError('Could not read the file.')
      return
    }
    try {
      const { settings, sourceApp } = parseSettingsImport(text)
      setPicked({ settings, sourceApp, fileName: file.name, preview: preview(settings) })
    } catch (e) {
      setRawText(text)
      setError(errorMessage(e, 'Could not read the file.'))
    }
  }

  const apply = () => {
    if (!picked) return
    onApply(picked.settings, picked.fileName)
    close()
  }

  const canApply = picked != null && picked.preview.changed > 0
  const footer = (
    <>
      <Button variant="ghost" size="md" onClick={close}>Cancel</Button>
      <Button variant="primary" size="md" onClick={apply} disabled={!canApply} data-autofocus={canApply || undefined}>
        Apply
      </Button>
    </>
  )

  return (
    <Modal open={open} onClose={close} title="Import settings" width="sm" icon="upload" footer={footer}>
      <div className="flex flex-col gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => { void pickFile(e.target.files?.[0] ?? null); e.target.value = '' }}
        />
        <Button variant="outline" size="md" onClick={() => fileRef.current?.click()}>
          Choose JSON file…
        </Button>

        {picked && <PreviewView picked={picked} appName={appName} dirtyCount={dirtyCount} />}

        {rawText !== null && (
          <pre className="max-h-64 overflow-auto px-2.5 py-2 text-[11px] font-mono whitespace-pre rounded-[6px] border border-[var(--danger-border)] bg-[var(--bg-2)] text-[var(--fg-2)]">
            {rawText.length > RAW_PREVIEW_CHARS ? `${rawText.slice(0, RAW_PREVIEW_CHARS)}\n… (truncated)` : rawText}
          </pre>
        )}
        {error && <FormError>{error}</FormError>}
      </div>
    </Modal>
  )
}

function PreviewView({ picked, appName, dirtyCount }: { picked: Picked; appName: string; dirtyCount: number }) {
  const { changed, missing, hidden } = picked.preview
  return (
    <div className="flex flex-col gap-1.5 text-[12.5px] text-[var(--fg-2)]">
      {changed === 0 ? (
        <p><CodeChip>{picked.fileName}</CodeChip> matches the current settings, nothing to apply.</p>
      ) : (
        <>
          <p>
            <span className="font-semibold text-[var(--fg)]">{changed}</span> setting{changed === 1 ? '' : 's'} will change
            from <CodeChip>{picked.fileName}</CodeChip>
            {missing > 0 && <>, including {missing} not in the file (reset to defaults)</>}.
          </p>
          {hidden > 0 && (
            <p className="text-[11.5px] text-[var(--fg-3)]">{hidden} of the changes {hidden === 1 ? 'is' : 'are'} outside the settings form; inspect {hidden === 1 ? 'it' : 'them'} via Show JSON before saving.</p>
          )}
          {picked.sourceApp && picked.sourceApp !== appName && (
            <p className="text-[11.5px] text-[var(--fg-3)]">Exported from app "{picked.sourceApp}". This app keeps its own name.</p>
          )}
          {dirtyCount > 0 && (
            <p className="text-[11.5px] text-[var(--warn)]">Your {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'} will be replaced.</p>
          )}
          <p className="text-[11.5px] text-[var(--fg-3)]">Applied values land as unsaved changes: review them, then Save.</p>
        </>
      )}
    </div>
  )
}
