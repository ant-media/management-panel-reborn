import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'

type Props = {
  title: string
  subtitle?: ReactNode
  // Resolved player-page URL, or null while the caller resolves it or on error.
  url: string | null
  loading: boolean
  error: string | null
  onClose: () => void
  // Runs with the player page's window on each load. Same-origin only, so never under `pnpm dev`.
  onPlayerLoad?: (win: Window) => void
  // A transient error floated over the top of the video, e.g. a failed PTZ move.
  notice?: { message: string; onDismiss: () => void } | null
}

// AMS's bundled player page in an iframe: no player dependency, and the page picks the
// protocol itself. Rendered only while playing, so closing unmounts the iframe and the
// playback session dies with it. The caller resolves the URL (token, protocol order), so
// this shell serves both live streams and VoD.
export function PlayerFrame({ title, subtitle, url, loading, error, onClose, onPlayerLoad, notice }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Focus lives in the iframe, so parent-document Escape never fires; mirror it onto the iframe doc.
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    const attach = () => iframe.contentDocument?.addEventListener('keydown', onKey)
    attach()
    iframe.addEventListener('load', attach)
    return () => {
      iframe.removeEventListener('load', attach)
      iframe.contentDocument?.removeEventListener('keydown', onKey)
    }
  }, [url, onClose])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !onPlayerLoad) return
    const run = () => {
      const win = iframe.contentDocument?.defaultView
      if (win) onPlayerLoad(win)
    }
    run()
    iframe.addEventListener('load', run)
    return () => iframe.removeEventListener('load', run)
  }, [url, onPlayerLoad])

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      icon="play"
      description={subtitle}
      width="xl"
      headerActions={
        <Button
          variant="ghost"
          size="iconSm"
          disabled={!url}
          title="Open in new tab"
          onClick={() => url && window.open(url, '_blank', 'noopener')}
        >
          <Icon name="maximize" size={14} />
        </Button>
      }
    >
      {/* Cap width by viewport height so the 16:9 video letterboxes to fit instead of scrolling the modal body. */}
      <div className="relative mx-auto aspect-video w-full max-w-[calc((100dvh_-_9rem)_*_16_/_9)] rounded-[8px] overflow-hidden bg-black">
        {url ? (
          <iframe
            ref={iframeRef}
            src={url}
            title={`Player for ${title}`}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-center px-8 text-[12.5px] text-white/60">
            {loading ? 'Starting player…' : error}
          </div>
        )}
        {notice && (
          <div
            role="alert"
            className="absolute top-3 inset-x-3 mx-auto w-fit animate-notice-in flex items-center gap-2 h-8 pl-3 pr-1 rounded-full bg-black/75 backdrop-blur-sm ring-1 ring-white/10 text-[12px] text-white"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] shrink-0" />
            <span className="min-w-0 truncate" title={notice.message}>{notice.message}</span>
            <button
              type="button"
              onClick={notice.onDismiss}
              aria-label="Dismiss"
              className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-white/60 hover:text-white hover:bg-white/10"
            >
              <Icon name="x" size={11} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
