import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Field, FormError } from '@/components/shared/form'
import { resultError } from '@/lib/api'
import { useVodActions } from './use-vod-actions'

type Props = {
  appName: string | undefined
  open: boolean
  onClose: () => void
  onImported?: () => void
}

export function ImportDirectoryModal({ appName, open, onClose, onImported }: Props) {
  const actions = useVodActions(appName)
  const [dir, setDir] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setDir(''); setBusy(false); setError(null) }
  }, [open])

  const submit = async () => {
    const path = dir.trim()
    if (!path || busy) return
    setBusy(true); setError(null)
    const res = await actions.importDirectory(path)
    setBusy(false)
    if (res.success) { onImported?.(); onClose() }
    else setError(resultError(res, 'Import failed. Check that the path exists and the server can read it.'))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title="Import VoDs from folder"
      description="Register video files already sitting in a folder on the server. The path is resolved on the server, not your machine."
      width="sm"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" onClick={submit} disabled={!dir.trim() || busy}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Server directory path"
          mono
          autoFocus
          value={dir}
          onChange={setDir}
          placeholder="/usr/local/antmedia/webapps/LiveApp/streams"
          disabled={busy}
        />
        {error && <FormError>{error}</FormError>}
      </div>
    </Modal>
  )
}
