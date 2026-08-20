import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { MOCKS_ENABLED, setMockOffline } from '@/lib/api'
import doorBackdrop from '@/assets/login-background.jpg'
import './index.css'

// Held from boot: the door mounts when the server dies, too late to fetch its backdrop.
const warmedDoorBackdrop = new Image()
warmedDoorBackdrop.src = doorBackdrop

async function start() {
  if (MOCKS_ENABLED) await import('@/lib/api/mocks')
  // Dev aid: fake a backend outage from the console to exercise the reconnect UI.
  if (import.meta.env.DEV && MOCKS_ENABLED) Object.assign(window, { setMockOffline })
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void start().catch(err => console.error('[bootstrap] failed:', err))
