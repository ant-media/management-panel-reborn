import { Icon } from '@/components/ui/icon'
import { ActionMenu } from '@/components/shared/action-menu'

// A field flagged by `fieldStatus`: an error (blocks Save, red banner) or a warning (this menu).
export type FlaggedField = {
  key: string
  label: string
  sectionId: string
  sectionTitle: string
  msg: string
}

// Warnings never block a save, so they get a quiet toolbar pill rather than a banner. Clicking
// one opens its section and scrolls to the row; without that the count is unactionable, since a
// collapsed section hides its rows.
export function WarningsMenu({ warnings, onJump }: {
  warnings: FlaggedField[]
  onJump: (sectionId: string, fieldKey: string) => void
}) {
  if (warnings.length === 0) return null

  return (
    <ActionMenu
      align="right"
      trigger={
        <span className="h-8 px-3 text-[12px] rounded-[6px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-[var(--warn-bg)] text-[var(--warn)] transition-[filter] hover:brightness-105">
          <Icon name="alert" size={12} />
          {warnings.length} warning{warnings.length > 1 ? 's' : ''}
          <Icon name="chevron-down" size={11} />
        </span>
      }
      items={warnings.map(w => ({
        label: <><span className="text-[var(--fg-3)]">{w.sectionTitle} › </span>{w.label}</>,
        onClick: () => onJump(w.sectionId, w.key),
      }))}
    />
  )
}
