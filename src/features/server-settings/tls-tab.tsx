import { useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Field, SelectField } from '@/components/shared/form'
import { DangerCallout } from '@/components/shared/danger-callout'
import { Pill } from '@/components/shared/pill'
import { ToastBanner } from '@/components/shared/toast'
import { Modal } from '@/components/ui/modal'
import { resultMessage } from '@/lib/api'
import { useToast } from '@/lib/use-toast'
import { checkDomain, configureSsl, type CertFiles, type SslType } from './use-ssl'
import { useLicence } from './use-licence'
import { useServerSettings } from './use-server-settings'

// Not in ServerSettings; legacy links the default HTTPS port too.
const HTTPS_PORT = 5443

export function TlsTab() {
  const { toast, flash, dismiss } = useToast()
  const { licence } = useLicence()
  const settings = useServerSettings()
  const [type, setType] = useState<SslType>('CUSTOM_DOMAIN')
  const [domain, setDomain] = useState('')
  const [files, setFiles] = useState<Partial<CertFiles>>({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [changing, setChanging] = useState(false)

  // `sslEnabled` = the server has a secure connector. As in legacy, the form opens by itself only
  // while SSL is off; an active setup keeps it behind Change SSL.
  const sslEnabled = settings.data?.sslEnabled === true
  const serverName = settings.data?.serverName?.trim()
  const formOpen = changing || (settings.data ? !sslEnabled : !!settings.error)

  // enable_ssl.sh only hands out an antmedia.cloud subdomain to a licensed or marketplace server.
  // Legacy's rule: any licence carrying an id, or a marketplace build. Locked while loading.
  const subdomainLocked = !settings.data?.buildForMarket && !licence?.licenceId
  const types: [SslType, string][] = [
    ['CUSTOM_DOMAIN', 'Use your own domain (auto Let’s Encrypt)'],
    ['ANTMEDIA_SUBDOMAIN', subdomainLocked
      ? 'Subdomain of antmedia.cloud (Enterprise licence required)'
      : 'Subdomain of antmedia.cloud (Enterprise / AWS Marketplace)'],
    ['CUSTOM_CERTIFICATE', 'Import your own certificate'],
  ]

  const needsDomain = type !== 'ANTMEDIA_SUBDOMAIN'
  const isCustomCert = type === 'CUSTOM_CERTIFICATE'
  const filesReady = !!files.fullChain && !!files.privateKey && !!files.chain
  const fqdn = domain.trim()
  const domainError = fqdn ? checkDomain(fqdn) : undefined
  const valid = needsDomain
    ? !!fqdn && !domainError && (!isCustomCert || filesReady)
    : !subdomainLocked

  const apply = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    const res = await configureSsl(type, needsDomain ? fqdn : '', isCustomCert ? (files as CertFiles) : undefined)
    setSubmitting(false)
    if (res.success) flash('ok', 'SSL configuration accepted. The server is restarting, give it a minute.')
    else if (res.restarting) flash('ok', 'The server is restarting to apply SSL (the connection dropped, as the restart does). Give it a minute, then reload the panel.')
    else {
      const why = resultMessage(res)
      flash('err', why ? `SSL setup failed: ${why}` : 'SSL setup failed. The server gave no reason. Check the server logs.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}

      <Card className="p-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px]">
        <span className="text-[11px] uppercase tracking-wider text-[var(--fg-3)]">SSL status</span>
        {settings.data
          ? <Pill tone={sslEnabled ? 'ok' : 'neutral'} dot>{sslEnabled ? 'active' : 'inactive'}</Pill>
          : <span className="text-[var(--fg-3)]">{settings.error ? 'unknown' : 'checking…'}</span>}
        {sslEnabled && serverName && (
          <a
            href={`https://${serverName}:${HTTPS_PORT}`}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate font-mono text-[var(--fg-2)] hover:text-[var(--fg)] hover:underline"
          >
            https://{serverName}:{HTTPS_PORT}
          </a>
        )}
        {sslEnabled && !formOpen && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setChanging(true)}>Change SSL</Button>
        )}
      </Card>

      {formOpen && (
        <Card className="p-5 flex flex-col gap-4">
          <SelectField
            label="Configuration type"
            value={type}
            onChange={v => setType(v as SslType)}
            options={types}
          />

          {!needsDomain && (
            <p className={subdomainLocked ? 'text-[12px] text-[var(--danger)]' : 'text-[12px] text-[var(--fg-2)]'}>
              {subdomainLocked
                ? 'Needs a valid Enterprise licence or an AWS Marketplace build.'
                : 'A subdomain of antmedia.cloud is allocated for this server automatically.'}
            </p>
          )}

          {needsDomain && (
            <Field
              label="Domain (FQDN)"
              mono
              placeholder="stream.example.com"
              hint="Must already resolve to this server's public IP."
              value={domain}
              onChange={setDomain}
              error={domainError}
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
            <span>Ant Media reports whether SSL is on, not which certificate is active, so this form only <em>applies</em> a new configuration.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {changing && (
              <Button variant="ghost" size="md" onClick={() => setChanging(false)} disabled={submitting}>Cancel</Button>
            )}
            <Button variant="primary" size="md" onClick={() => setConfirmOpen(true)} disabled={!valid || submitting}>
              {submitting && <Icon name="refresh" size={12} className="animate-spin" />}
              {submitting ? 'Applying…' : 'Configure SSL'}
            </Button>
          </div>
        </Card>
      )}

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
