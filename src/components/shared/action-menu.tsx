import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icon'
import { useAnchoredPosition } from '@/components/shared/use-anchored-position'
import { cn } from '@/lib/utils'

// Compact popover menu for table-row / panel-header action columns. Items are
// declared inline at the call site, so menu contents stay per-row without
// prop-drilling row state through a dedicated component.
//
// The menu is portaled to <body> and positioned `fixed` against the trigger, so
// it escapes the overflow-clip of any scroll ancestor (table / detail drawer)
// instead of being cropped inside it. Items may carry one level of `children`,
// rendered as a side flyout.

export type MenuItem = 'sep' | MenuEntry

type MenuEntry = {
  icon?: IconName
  label: ReactNode
  hint?: string
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  children?: MenuItem[]
}

type Props = {
  items: MenuItem[]
  align?: 'left' | 'right'
  // Replaces the default `⋯` button. The node is wrapped in an unstyled <button> that owns the
  // click + aria, so pass a styled non-interactive element (never a <button>).
  trigger?: ReactNode
}

const MARGIN = 6 // keep the submenu flyout clear of the viewport edge

const ROW_CLASS = 'w-full px-2.5 py-1.5 text-left text-[12px] flex items-center gap-2 transition-colors'
const PANEL_CLASS = 'min-w-[180px] bg-[var(--card)] border border-[var(--border)] rounded-[7px] shadow-xl py-1'

export function ActionMenu({ items, align = 'right', trigger }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  const pos = useAnchoredPosition({ open, triggerRef, panelRef: menuRef, align })

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={triggerRef} className="inline-flex">
      {trigger ? (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex"
        >
          {trigger}
        </button>
      ) : (
        <Button
          variant="ghost"
          size="iconSm"
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
          aria-haspopup="menu"
          aria-expanded={open}
          title="More actions"
        >
          <Icon name="more-h" size={13} />
        </Button>
      )}
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          onClick={e => e.stopPropagation()}
          onAuxClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? 'visible' : 'hidden', // hide until measured (1 layout pass)
          }}
          className={cn('z-50', PANEL_CLASS)}
        >
          <MenuList items={items} close={close} />
        </div>,
        document.body,
      )}
    </span>
  )
}

function MenuList({ items, close }: { items: MenuItem[]; close: () => void }) {
  return (
    <>
      {items.map((it, i) => it === 'sep'
        ? <div key={`s-${i}`} className="my-1 h-px bg-[var(--border)]" />
        : it.children
          ? <SubMenu key={i} item={it} close={close} />
          : <MenuRow key={i} item={it} onClick={() => { it.onClick?.(); close() }} />,
      )}
    </>
  )
}

function MenuRow({ item, onClick, trailing, hovered }: {
  item: MenuEntry
  onClick: () => void
  trailing?: ReactNode
  hovered?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={onClick}
      className={cn(
        ROW_CLASS,
        item.danger
          ? cn('text-[var(--danger)] hover:bg-[var(--danger-bg)]', hovered && 'bg-[var(--danger-bg)]')
          : cn('text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]', hovered && 'bg-[var(--bg-2)] text-[var(--fg)]'),
        item.disabled && 'opacity-40 pointer-events-none',
      )}
    >
      {item.icon && <Icon name={item.icon} size={12} className="text-[var(--fg-3)]" />}
      <span className="flex-1">{item.label}</span>
      {item.hint && <span className="text-[10.5px] font-mono text-[var(--fg-3)]">{item.hint}</span>}
      {trailing}
    </button>
  )
}

function SubMenu({ item, close }: { item: MenuEntry; close: () => void }) {
  const [open, setOpen] = useState(false)
  const [fly, setFly] = useState({ left: false, top: -4 }) // flip side + vertical nudge to stay on-screen
  const wrapRef = useRef<HTMLDivElement>(null)
  const flyRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const row = wrapRef.current?.getBoundingClientRect()
    const el = flyRef.current
    if (!row || !el) return
    const overflowBottom = row.top - 4 + el.offsetHeight + MARGIN - window.innerHeight
    setFly({
      left: row.right + el.offsetWidth + MARGIN > window.innerWidth,
      top: overflowBottom > 0 ? -4 - overflowBottom : -4,
    })
  }, [open])

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <MenuRow
        item={item}
        hovered={open}
        onClick={() => setOpen(o => !o)}
        trailing={<Icon name="chevron-right" size={12} className="text-[var(--fg-3)] -mr-1" />}
      />
      {open && (
        // Transparent wrapper touches the row edge so a slow pointer never crosses dead
        // space and trips onMouseLeave; the visual gap is inner padding, not an outer margin.
        <div
          ref={flyRef}
          style={{ top: fly.top }}
          className={cn('absolute z-10', fly.left ? 'right-full pr-1' : 'left-full pl-1')}
        >
          <div role="menu" className={PANEL_CLASS}>
            <MenuList items={item.children!} close={close} />
          </div>
        </div>
      )}
    </div>
  )
}
