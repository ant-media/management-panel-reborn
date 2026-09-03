import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Modal } from '@/components/ui/modal'
import { useStoredState } from '@/lib/localStorage'
import logo from '@/assets/ant-media-logo.png'

// First-run welcome. The checkbox is what makes the dismissal permanent, and it starts ticked,
// so any close (X, backdrop, Escape, the button) is the last one unless the user unticks it.

// Exported so the Server Settings licence dialog can stand down while this one owns the
// screen: two stacked first-run dialogs read as a glitch.
export const BETA_NOTICE_SEEN_KEY = 'ams.beta.notice.seen'

// One serif line in an all-sans panel. No webfont to load, and the generic keeps it
// resolvable in every browser.
const DISPLAY_FONT = "ui-serif, Georgia, 'Times New Roman', serif"

export function BetaNotice() {
  const [seen, setSeen] = useStoredState(BETA_NOTICE_SEEN_KEY, false)
  const [closed, setClosed] = useState(false)
  const [dontShow, setDontShow] = useState(true)

  if (seen || closed) return null

  const dismiss = () => {
    if (dontShow) setSeen(true)
    setClosed(true)
  }

  return (
    <Modal open onClose={dismiss} title="Welcome" titleHidden width="md">
      <div className="px-6 pt-3 pb-2 flex flex-col items-center text-center">
        <img src={logo} alt="" className="w-14 h-14" />

        {/* The accessible name is Modal's sr-only title, so this one is decoration. */}
        <div aria-hidden className="mt-5 text-[34px] leading-none text-[var(--fg)]" style={{ fontFamily: DISPLAY_FONT }}>
          Welcome
        </div>

        <div className="mt-5 max-w-[410px] flex flex-col gap-3 text-[13px] leading-relaxed text-[var(--fg-2)]">
          <p>
            Hello there! This is a ground-up rebuild of the Ant Media web panel. It's still in{' '}
            <strong className="font-semibold text-[var(--fg)]">beta</strong>, so you may find a feature
            missing, and hit a rough edge or two.
          </p>
          <p className="text-[var(--fg-3)]">
            We'll keep growing it. The classic panel is still there whenever you want it: log out, then
            pick it on the login screen.
          </p>
        </div>

        <label className="mt-6 flex items-center gap-2.5 cursor-pointer select-none">
          <Checkbox checked={dontShow} onChange={setDontShow} />
          <span className="text-[12px] text-[var(--fg-3)]">Don't show this again</span>
        </label>

        <Button variant="primary" size="md" onClick={dismiss} data-autofocus className="mt-4 px-8">
          Got it
        </Button>
      </div>
    </Modal>
  )
}
