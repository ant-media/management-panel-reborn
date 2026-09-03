import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BETA_NOTICE_SEEN_KEY } from '@/components/chrome/beta-notice'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { DangerCallout } from '@/components/shared/danger-callout'
import { storage } from '@/lib/localStorage'
import { useLicence } from './use-licence'

// Keyed by pathname in the layout, so a mount is a page open. Shows on the first page, then again
// on a page change once a minute has passed since it was dismissed.
export function LicenceWarningModal() {
  const { state, warningDismissedAt, dismissWarning } = useLicence()
  const navigate = useNavigate()
  const [mountedAt] = useState(() => Date.now())
  // Snapshot at mount so this never stacks on the first-run welcome; the next page shows it instead.
  const [betaSeen] = useState(() => storage.readJson(BETA_NOTICE_SEEN_KEY, false))
  const open = betaSeen && !!state?.broken && (warningDismissedAt == null || mountedAt - warningDismissedAt > 60_000)

  return (
    <Modal
      open={open}
      onClose={dismissWarning}
      icon="alert"
      title="License not valid"
      width="sm"
      footer={
        <Button variant="primary" size="md" onClick={() => { dismissWarning(); void navigate('/settings') }}>
          Update license key
        </Button>
      }
    >
      <DangerCallout icon="alert">
        License status: <span className="text-[var(--danger)] font-medium">{state?.label}</span>.
        Enter a valid key in Settings.
      </DangerCallout>
    </Modal>
  )
}
