import { createContext, useContext, useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/shared/pill'
import { Tooltip } from '@/components/shared/tooltip'
import { useEnterprise } from '@/contexts/edition-context'

const ENTERPRISE_URL = 'https://antmedia.io/#products'
const AVAILABLE = 'Available in Enterprise Edition.'
const SEE_PLANS = `${AVAILABLE} Click to see plans.`

// Badge and lock render only on Community, so call sites never check the edition. Inside a lock
// they stand down, the outer lock already covers them.
const InsideLock = createContext(false)

// `link={false}` inside another link or button, where an <a> can't nest.
export function EnterpriseBadge({ link = true }: { link?: boolean }) {
  const locked = useEnterprise() === false
  const covered = useContext(InsideLock)
  if (!locked || covered) return null

  const pill = (
    <Pill tone="info">
      <Icon name="lock" size={9} />
      Enterprise
    </Pill>
  )
  if (!link) return pill

  return (
    <Tooltip content={SEE_PLANS} focusable={false}>
      <a
        href={ENTERPRISE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-[4px] transition-all duration-150 hover:brightness-[0.94] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {pill}
      </a>
    </Tooltip>
  )
}

export function EnterpriseLock({ children }: { children: ReactNode }) {
  const locked = useEnterprise() === false
  const covered = useContext(InsideLock)
  // A touch tap only explains, never jumps to another site. The badge is the link there.
  const [touch, setTouch] = useState(false)
  if (!locked || covered) return <>{children}</>

  // `inert` kills click, focus and keys inside; hover and click fall through to the outer div.
  return (
    <Tooltip content={touch ? AVAILABLE : SEE_PLANS} focusable={false} block>
      <div
        className="cursor-not-allowed [-webkit-tap-highlight-color:transparent]"
        onPointerDown={e => setTouch(e.pointerType !== 'mouse')}
        onClick={() => { if (!touch) window.open(ENTERPRISE_URL, '_blank', 'noopener') }}
      >
        <div inert className="opacity-50 grayscale">
          <InsideLock.Provider value>{children}</InsideLock.Provider>
        </div>
      </div>
    </Tooltip>
  )
}

export function PlansLink({ children }: { children: ReactNode }) {
  return (
    <a href={ENTERPRISE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--fg)]">
      {children}
    </a>
  )
}

// Says why the items next to it are disabled. Plain: the caller already gates on the edition.
export function EnterpriseNote({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon name="lock" size={10} />
      {children}
      <PlansLink>See plans</PlansLink>
    </span>
  )
}
