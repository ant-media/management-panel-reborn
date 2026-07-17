import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Page } from '@/components/shared/page'

export function SupportPage() {
  return (
    <Page title="Support" subtitle="Reach the team">
      <Card className="p-12 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-2)] flex items-center justify-center mb-3">
            <Icon name="support" size={20} className="text-[var(--fg-3)]" aria-hidden />
          </div>
          <div className="text-[13px] text-[var(--fg-2)] mb-1">Outside v1 scope</div>
          <div className="text-[11.5px] text-[var(--fg-3)]">A ticket form / chat widget lives here in the real build.</div>
        </div>
      </Card>
    </Page>
  )
}
