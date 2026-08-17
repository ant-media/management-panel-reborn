import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/contexts/auth-context'
import background from '@/assets/login-background.jpg'
import logo from '@/assets/ant-media-logo.png'

export function PublicLayout() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />

  // The legacy console's login photo, so switching doors holds the backdrop still and only the
  // card changes. Darkened rather than greyed: the old theme's flat #5e5e5e wash desaturates the
  // photo and still leaves white text at 4.6:1 over the bright sky. The colour under the image is
  // the fallback while it decodes, so a slow load is never a white flash.
  return (
    <div
      className="door min-h-screen relative bg-[#22252b] bg-cover bg-center flex items-center justify-center px-4 py-10"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="absolute inset-0 bg-black/45 dark:bg-black/50" aria-hidden />
      <div className="relative w-full max-w-[400px]">
        <div className="flex items-center justify-center mb-6 gap-2">
          <img src={logo} alt="" className="w-8 h-8" />
          <span className="text-[14px] font-semibold text-white">Ant Media Server</span>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
