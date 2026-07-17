import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'
import { Pill } from '@/components/shared/pill'
import { CopyChip } from '@/components/shared/copy-chip'
import { Field, FormError } from '@/components/shared/form'
import { resultError, useApi } from '@/lib/api'
import { broadcasts, restream } from '@/lib/api/endpoints'
import type { Broadcast, BroadcastStatus, Endpoint } from './types'

type Flash = (kind: 'ok' | 'err', message: string) => void

// rtmp:// rtmps:// or srt://, the schemes the backend can republish to.
const URL_RE = /^(rtmps?|srt):\/\/\S+$/i

// Map an endpoint's muxer status to a status pill. broadcasting = forwarding now;
// error/failed = the push died; created/preparing = queued until the stream goes live.
function statusPill(status?: BroadcastStatus) {
  switch (status) {
    case 'broadcasting': return <Pill tone="ok" dot>forwarding</Pill>
    case 'finished': return <Pill tone="neutral">finished</Pill>
    case 'error':
    case 'failed':
    case 'terminated_unexpectedly': return <Pill tone="err" dot>failed</Pill>
    default: return <Pill tone="info">{status ?? 'created'}</Pill>
  }
}

// Add-an-endpoint form + the live list of forwarding targets. Data-source agnostic:
// the caller passes the current `endpoints` and an `onChanged` to re-fetch after a
// mutation, so the same body serves the drawer section and the standalone modal.
export function EndpointsSection({ appName, streamId, endpoints, onChanged, flash, autoFocus, loading }: {
  appName: string
  streamId: string
  endpoints: Endpoint[]
  onChanged: () => void
  flash?: Flash
  autoFocus?: boolean
  // First-load gate for callers that fetch the list themselves (the modal); the
  // drawer already has its broadcast, so it leaves this unset.
  loading?: boolean
}) {
  const api = useMemo(() => restream(appName), [appName])
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Track per-id so two concurrent removals each disable their own row.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set())

  const add = async () => {
    const value = url.trim()
    if (!value) return
    if (!URL_RE.test(value)) { setError('Enter a valid rtmp://, rtmps:// or srt:// URL.'); return }
    if (endpoints.some(e => e.endpointUrl === value)) { setError('That endpoint is already added.'); return }
    setBusy(true)
    setError(null)
    const res = await api.addEndpoint(streamId, value)
    setBusy(false)
    if (res.success) { setUrl(''); onChanged(); flash?.('ok', 'Endpoint added') }
    else setError(resultError(res, 'Could not add the endpoint.'))
  }

  const remove = async (ep: Endpoint) => {
    const id = ep.endpointServiceId
    setRemoving(prev => new Set(prev).add(id))
    const res = await api.removeEndpoint(streamId, id)
    setRemoving(prev => { const next = new Set(prev); next.delete(id); return next })
    if (res.success) { onChanged(); flash?.('ok', 'Endpoint removed') }
    else flash?.('err', resultError(res, 'Could not remove the endpoint.'))
  }

  return (
    <div className="space-y-3">
      <form onSubmit={e => { e.preventDefault(); void add() }} className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <Field
            label="RTMP / SRT URL"
            value={url}
            onChange={v => { setUrl(v); if (error) setError(null) }}
            placeholder="rtmp://… or srt://…"
            mono
            autoFocus={autoFocus}
            disabled={busy}
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
          <Icon name="plus" size={13} /> Add
        </Button>
      </form>

      {error && <FormError>{error}</FormError>}

      {endpoints.length === 0 ? (
        loading ? (
          <p className="text-[11.5px] text-[var(--fg-3)]">Loading…</p>
        ) : (
          <p className="text-[11.5px] text-[var(--fg-3)] leading-snug">
            No re-streaming targets. Add an RTMP or SRT URL above to forward this stream to an external server.
          </p>
        )
      ) : (
        <ul className="space-y-1.5">
          {endpoints.map(ep => (
            <li
              key={ep.endpointServiceId}
              className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-2"
            >
              {statusPill(ep.status)}
              <span
                className="flex-1 min-w-0 font-mono text-[11.5px] text-[var(--fg-2)] truncate"
                title={ep.endpointUrl}
              >
                {ep.endpointUrl}
              </span>
              <CopyChip value={ep.endpointUrl} showValue={false} size="sm" />
              <button
                type="button"
                onClick={() => void remove(ep)}
                disabled={removing.has(ep.endpointServiceId)}
                aria-label="Remove endpoint"
                title="Remove endpoint"
                className="shrink-0 text-[var(--fg-3)] hover:text-[var(--danger)] transition-colors disabled:opacity-40"
              >
                <Icon name="trash" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Legacy-familiar entry point: the row ⋯ menu opens this modal. It owns a light
// poll of the broadcast so the endpoint list + statuses stay live while open.
// Mount it only while open (the caller gates on the target) so each open starts
// from a clean fetch, never flashes the previously-viewed stream's endpoints.
export function EndpointsModal({ appName, streamId, streamName, onClose, onFlash }: {
  appName: string
  streamId: string
  streamName: string
  onClose: () => void
  onFlash?: Flash
}) {
  const api = useMemo(() => broadcasts(appName), [appName])
  const detail = useApi<Broadcast>(
    signal => api.get(streamId, signal),
    { pollMs: 3_000, refetchKey: `${appName}|${streamId}` },
  )
  return (
    <Modal
      open
      onClose={onClose}
      title="RTMP Endpoints"
      description={<>Forward <span className="font-medium text-[var(--fg-2)]">{streamName}</span> to external RTMP or SRT destinations.</>}
      width="md"
    >
      {detail.error && !detail.data ? (
        <FormError>Couldn't load this stream, it may have been deleted.</FormError>
      ) : (
        <EndpointsSection
          appName={appName}
          streamId={streamId}
          endpoints={detail.data?.endPointList ?? []}
          onChanged={detail.refresh}
          flash={onFlash}
          autoFocus
          loading={detail.isLoading}
        />
      )}
    </Modal>
  )
}
