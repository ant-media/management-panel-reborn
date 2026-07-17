import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { Page } from '@/components/shared/page'

type Props = {
  icon: IconName
  title: string
  subtitle?: string
  phase: number
}

export function StubPage({ icon, title, subtitle, phase }: Props) {
  return (
    <Page title={title} subtitle={subtitle}>
      <Card className="p-12 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-2)] flex items-center justify-center mb-3">
            <Icon name={icon} size={20} className="text-[var(--fg-3)]" aria-hidden />
          </div>
          <div className="text-[13px] text-[var(--fg-2)] mb-1">Stub: implementation lands in Phase {phase}</div>
          <div className="text-[11.5px] text-[var(--fg-3)]">This page exists to verify navigation works.</div>
        </div>
      </Card>
    </Page>
  )
}
