import { registerMock } from '@/lib/api'
import { storage } from '@/lib/localStorage'

// In-memory session for the mock transport, mirrored to localStorage so a tab
// refresh behaves like a real cookie-backed session. Flip `firstLoginDone` to
// false (or clear the storage key) to exercise the /register flow.
type Session = { firstLoginDone: boolean; authenticatedAs: string | null }

const STORAGE_KEY = 'ams.mock.session'
const DEFAULT: Session = { firstLoginDone: true, authenticatedAs: null }

function loadSession(): Session {
  return { ...DEFAULT, ...storage.readJson<Partial<Session>>(STORAGE_KEY, {}) }
}

const session = loadSession()
const persist = () => storage.writeJson(STORAGE_KEY, session)

// Lets the users mock surface the logged-in account as a "you" row for any email.
export const mockAuthedEmail = () => session.authenticatedAs

registerMock('GET', '/rest/v2/first-login-status',    () => ({ success: !session.firstLoginDone }))
registerMock('GET', '/rest/v2/authentication-status', () => ({ success: session.authenticatedAs !== null }))

registerMock('POST', '/rest/v2/users/authenticate', ({ body }) => {
  const email = (body as { email?: string } | undefined)?.email
  if (!email) return { success: false }
  session.authenticatedAs = email
  persist()
  return { success: true, message: 'system/ADMIN' }
})

registerMock('POST', '/rest/v2/users/initial', () => {
  if (session.firstLoginDone) return { success: false }
  session.firstLoginDone = true
  persist()
  return { success: true }
})

registerMock('DELETE', '/rest/v2/users/logout', () => {
  session.authenticatedAs = null
  persist()
  return { success: true }
})
