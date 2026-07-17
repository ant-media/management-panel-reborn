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
}

// AMS's bundled player page in an iframe: no player dependency, and the page picks the
// protocol itself. Rendered only while playing, so closing unmounts the iframe and the
// playback session dies with it. The caller resolves the URL (token, protocol order), so
// this shell serves both live streams and VoD.
export function PlayerFrame({ title, subtitle, url, loading, error, onClose }: Props) {
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
      <div className="mx-auto aspect-video w-full max-w-[calc((100dvh_-_9rem)_*_16_/_9)] rounded-[8px] overflow-hidden bg-black">
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
      </div>
    </Modal>
  )
}
