import { useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { Tooltip } from '@/components/shared/tooltip'
import { cn } from '@/lib/utils'
import { previewUrl } from './url-builder'
import type { Broadcast } from './types'
import { isLive } from './types'

const SIZES = {
  sm: 'w-[60px] h-[34px]',
  md: 'w-[100px] h-[56px]',
  lg: 'w-[160px] h-[90px]',
} as const

const GLYPHS = {
  sm: { placeholder: 14, off: 13, play: 9, badge: 'w-[22px] h-[22px]' },
  md: { placeholder: 22, off: 20, play: 12, badge: 'w-8 h-8' },
  lg: { placeholder: 28, off: 26, play: 15, badge: 'w-10 h-10' },
} as const

type Props = {
  appName: string
  broadcast: Broadcast
  size?: keyof typeof SIZES
  // The /previews/{id}.png file only exists when the app has Generate Preview enabled.
  // The caller knows the app-settings flag and passes it through; we use it to skip
  // the broken-image fetch entirely.
  hasPreview?: boolean
  // Live streams only: turns the thumb into a play button, revealed on hover of the
  // caller's `group` (the table row).
  onPlay?: () => void
}

export function Thumb({ appName, broadcast, size = 'sm', hasPreview, onPlay }: Props) {
  const live = isLive(broadcast.status)
  const [failed, setFailed] = useState(false)
  const showImage = live && hasPreview && !failed
  const playable = live && Boolean(onPlay)
  const glyph = GLYPHS[size]
  const roomy = size !== 'sm'

  // One tooltip for the whole thumb, anchored on the frame rather than on the (absolutely
  // positioned, so zero-height) play button. Instant: in a dense table a delay reads as an
  // unresponsive control. The play button carries its own focus, so don't add a second tab stop.
  const hint = playable ? 'Play stream'
    : showImage ? undefined                                   // a real preview is on screen; nothing to explain
    : hasPreview && !live ? 'Stream offline'
    : hasPreview ? 'Preview unavailable'
    : 'Preview generation is disabled for this app'

  return (
    <Tooltip content={hint} delay={0} focusable={!playable}>
      <div className={cn('relative rounded-[5px] overflow-hidden bg-[var(--bg-3)] shrink-0', SIZES[size])}>
        {showImage ? (
          <img
            src={previewUrl(appName, broadcast.streamId)}
            onError={() => setFailed(true)}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : hasPreview && !live ? (
          // Preview is enabled but the stream is offline: nothing to preview yet.
          <div className="w-full h-full flex items-center justify-center text-[var(--fg-3)]">
            <Icon name="video" size={glyph.placeholder} />
          </div>
        ) : (
          // No preview to show: generation disabled (any stream, live or not) or a live image that failed.
          <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-[var(--fg-3)]">
            <Icon name="eye-off" size={glyph.off} />
            {roomy && <span className="text-[10px] text-[var(--fg-3)]">Preview off</span>}
          </div>
        )}
        {/* Live badge overlays whatever's behind it (real preview, "preview off" placeholder, or a
            failed-image fallback) so it never blinks out. On hover it recedes, but stays readable,
            so it doesn't fight the red play button for attention. */}
        {live && (
          <div className={cn(
            'absolute top-1 left-1 px-1 rounded-[2px] bg-[var(--live)] text-[8px] font-bold tracking-wider text-white leading-[1.5] pointer-events-none shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
            playable && 'transition-opacity group-hover:opacity-45',
          )}>LIVE</div>
        )}
        {/* Resting: a dimmed green badge, so the thumb reads as playable without a hover. Row hover
            brings it to full --ok over a scrim and pops it past the target before settling. Red is
            the LIVE tag's alone, so red means live and green means play in both modes. Hover is the
            row's (`group`), not the thumb's. */}
        {playable && (
          <button
            type="button"
            aria-label="Play stream"
            onClick={e => { e.stopPropagation(); onPlay?.() }}
            className="absolute inset-0 flex items-center justify-center rounded-[5px] outline-none transition-colors group-hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
          >
            <span className={cn(
              'flex items-center justify-center rounded-full bg-[var(--ok-deep)] text-white opacity-75 scale-90 transition-all duration-150',
              'group-hover:bg-[var(--ok)] group-hover:opacity-100 group-hover:scale-110 group-hover:shadow-lg group-hover:animate-play-pop',
              glyph.badge,
            )}>
              <Icon name="play" size={glyph.play} className="fill-current ml-px" />
            </span>
          </button>
        )}
      </div>
    </Tooltip>
  )
}

// Both states are the same box; only the glyph differs, so the column can never change width.
const PLAY_CELL_FACE = 'flex-1 flex items-center justify-center border-r border-[var(--border)] bg-[var(--bg-2)]'

// The compact leading cell: the play control *is* the cell, full-bleed and flush to the card edge,
// painted as the drawer's Play tile (both are on screen whenever this renders). Hover lifts to
// --bg-3, not --bg-2, or the cell dissolves into the row's own hover.
//
// `absolute inset-0` rather than `h-full` because the compact density mode adds td padding that a
// percentage height would inset, so the cell must be `relative`. The `grid` wrapper is what gives
// Tooltip's span a full-size box to measure: wrap the absolute child directly and the bubble lands
// in the cell's corner.
export function PlayCell({ broadcast, onPlay }: { broadcast: Broadcast; onPlay: () => void }) {
  const playable = isLive(broadcast.status)
  return (
    <div className="absolute inset-0 grid">
      <Tooltip content={playable ? 'Play stream' : 'Stream offline'} delay={0} focusable={false}>
        {playable ? (
          <button
            type="button"
            aria-label="Play stream"
            onClick={e => { e.stopPropagation(); onPlay() }}
            className={cn(PLAY_CELL_FACE, 'transition-colors outline-none group-hover:bg-[var(--bg-3)] group-hover:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]')}
          >
            <Icon name="play" size={16} className="text-[var(--ok)]" />
          </button>
        ) : (
          <div className={cn(PLAY_CELL_FACE, 'text-[var(--fg-3)]')}>
            <Icon name="video" size={15} />
          </div>
        )}
      </Tooltip>
    </div>
  )
}
