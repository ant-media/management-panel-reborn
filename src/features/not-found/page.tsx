import { Link, useLocation } from 'react-router'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Page } from '@/components/shared/page'

export function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <Page title="Page not found" subtitle={<span className="font-mono">{pathname}</span>}>
      <Card className="p-12 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-2)] flex items-center justify-center mb-3">
            <Icon name="info" size={20} className="text-[var(--fg-3)]" aria-hidden />
          </div>
          <div className="text-[13px] text-[var(--fg-2)] mb-3">No route matches this URL.</div>
          <Link to="/" className="text-[12px] text-[var(--accent)] hover:underline">Back to dashboard</Link>
        </div>
      </Card>
    </Page>
  )
}
