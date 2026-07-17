import { useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Field, SelectField } from '@/components/shared/form'
import { DangerCallout } from '@/components/shared/danger-callout'
import { ToastBanner } from '@/components/shared/toast'
import { Modal } from '@/components/ui/modal'
import { resultMessage } from '@/lib/api'
import { useToast } from '@/lib/use-toast'
import { configureSsl, type CertFiles, type SslType } from './use-ssl'

const TYPES: [SslType, string][] = [
  ['CUSTOM_DOMAIN', 'Use your own domain (auto Let’s Encrypt)'],
  ['ANTMEDIA_SUBDOMAIN', 'Subdomain of antmedia.cloud (Enterprise)'],
  ['CUSTOM_CERTIFICATE', 'Import your own certificate'],
]

export function TlsTab() {
  const { toast, flash, dismiss } = useToast()
  const [type, setType] = useState<SslType>('CUSTOM_DOMAIN')
  const [domain, setDomain] = useState('')
  const [files, setFiles] = useState<Partial<CertFiles>>({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const needsDomain = type !== 'ANTMEDIA_SUBDOMAIN'
  const isCustomCert = type === 'CUSTOM_CERTIFICATE'
  const filesReady = !!files.fullChain && !!files.privateKey && !!files.chain
  const valid = (!needsDomain || domain.trim() !== '') && (!isCustomCert || filesReady)

  const apply = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    const res = await configureSsl(type, domain.trim(), isCustomCert ? (files as CertFiles) : undefined)
    setSubmitting(false)
    if (res.success) flash('ok', 'SSL configuration accepted. The server is restarting, give it a minute.')
    else {
      const why = resultMessage(res)
      flash('err', why ? `SSL setup failed: ${why}` : 'SSL setup failed. The server gave no reason. Check the server logs.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}

      <Card className="p-5 flex flex-col gap-4">
        <SelectField
          label="Configuration type"
          value={type}
          onChange={v => setType(v as SslType)}
          options={TYPES}
        />

        {needsDomain && (
          <Field
            label="Domain (FQDN)"
            mono
            placeholder="stream.example.com"
            hint="Must already resolve to this server's public IP."
            value={domain}
            onChange={setDomain}
          />
        )}

        {isCustomCert && (
          <div className="flex flex-col gap-3">
            <FilePick label="Full chain file" accept=".crt,.pem" file={files.fullChain} onPick={f => setFiles(s => ({ ...s, fullChain: f }))} />
            <FilePick label="Private key file" accept=".key,.pem" file={files.privateKey} onPick={f => setFiles(s => ({ ...s, privateKey: f }))} />
            <FilePick label="Chain file" accept=".crt,.pem" file={files.chain} onPick={f => setFiles(s => ({ ...s, chain: f }))} />
          </div>
        )}

        <div className="text-[11.5px] text-[var(--fg-3)] flex items-start gap-2">
          <Icon name="info" size={13} className="shrink-0 mt-px" />
          <span>Ant Media can’t read back the active certificate, so this form only <em>applies</em> a configuration; it doesn’t show the current one.</span>
        </div>

        <div className="flex items-center justify-end pt-1">
          <Button variant="primary" size="md" onClick={() => setConfirmOpen(true)} disabled={!valid || submitting}>
            {submitting && <Icon name="refresh" size={12} className="animate-spin" />}
            {submitting ? 'Applying…' : 'Configure SSL'}
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Apply SSL configuration?"
        width="sm"
        dismissible={!submitting}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setConfirmOpen(false)} data-autofocus>Cancel</Button>
            <Button variant="primary" size="md" onClick={apply}>Apply &amp; restart</Button>
          </>
        }
      >
        <DangerCallout>
          Applying SSL <strong>restarts Ant Media Server</strong>. Active streams will drop and the panel will be
          unreachable for up to a minute while it comes back.
        </DangerCallout>
      </Modal>
    </div>
  )
}

function FilePick({ label, accept, file, onPick }: { label: string; accept: string; file?: File; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="text-[12px] font-medium text-[var(--fg)] mb-1.5">{label} <span className="font-normal text-[var(--fg-3)]">({accept})</span></div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="md" onClick={() => ref.current?.click()}>
          <Icon name="upload" size={12} /> Choose file
        </Button>
        <span className="text-[12px] text-[var(--fg-3)] truncate font-mono">{file?.name ?? 'No file selected'}</span>
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f) }}
        />
      </div>
    </div>
  )
}
