import { registerMock } from '@/lib/api'
import type { ServerSettings } from '@/features/server-settings/use-server-settings'
import type { User } from '@/features/server-settings/use-users'
import { mockAuthedEmail } from './auth'

// ── Server settings ──────────────────────────────────────────────────────────
// A realistic ServerSettings slice. The trailing fields are NOT editable by the
// panel (the POST only persists serverName/licenceKey/nodeGroup/logLevel); they're
// here to prove the unsurfaced fields survive a round-trip.
let serverSettings: ServerSettings = {
  serverName: 'ams-origin-01.eu-west.example.com',
  licenceKey: 'AMS-DEMO-0000-1111-2222',
  logLevel: 'INFO',
  nodeGroup: 'default',
  sslEnabled: true,
  buildForMarket: false,
  hostAddress: '185.20.41.12',
  defaultHttpPort: 5080,
  heartbeatEnabled: true,
  useGlobalIp: false,
  srtPort: 4200,
  originServerPort: 5000,
}

registerMock('GET', '/rest/v2/server-settings', () => ({ ...serverSettings }))

// Flip to `false` to see the Community-edition warnings in the app-settings editor.
registerMock('GET', '/rest/v2/enterprise-edition', () => ({ success: true }))

// Faithful to the backend: only four fields persist, and serverName/licenceKey are
// BLANKED when absent (so a buggy partial POST visibly corrupts them here too).
registerMock('POST', '/rest/v2/server-settings', ({ body }) => {
  if (!body || typeof body !== 'object') return { success: false, message: 'Empty settings payload' }
  const next = body as ServerSettings
  serverSettings = {
    ...serverSettings,
    serverName: next.serverName ?? '',
    licenceKey: next.licenceKey ?? '',
    nodeGroup: next.nodeGroup ?? 'default',
    logLevel: next.logLevel ?? serverSettings.logLevel,
  }
  return { success: true }
})

// ── SSL (write-only, multipart) ──────────────────────────────────────────────
registerMock('POST', '/rest/v2/ssl-settings', ({ query, body }) => {
  const type = String(query.type ?? '')
  const domain = String(query.domain ?? '')
  const has = (k: string) => body instanceof FormData && body.get(k) != null
  if (type !== 'ANTMEDIA_SUBDOMAIN' && !domain) return { success: false, message: 'Domain is required for this type.' }
  if (type === 'CUSTOM_CERTIFICATE' && !(has('fullChainFile') && has('privateKeyFile') && has('chainFile')))
    return { success: false, message: 'All three certificate files are required.' }
  serverSettings.sslEnabled = true
  return { success: true, message: 'SSL configured. The server is restarting.' }
})

// ── Users ────────────────────────────────────────────────────────────────────
const users: User[] = [
  { email: 'admin@antmedia.io', firstName: 'Site', lastName: 'Admin', userType: 'ADMIN', scope: 'system', appNameUserType: { system: 'ADMIN' } },
  { email: 'ops@antmedia.io', firstName: 'Ops', lastName: 'Engineer', userType: 'USER', scope: 'system', appNameUserType: { system: 'USER' } },
  { email: 'viewer@antmedia.io', firstName: 'Read', lastName: 'Only', userType: 'READ_ONLY', scope: 'system', appNameUserType: { system: 'READ_ONLY' } },
]

registerMock('GET', '/rest/v2/user-list', () => {
  // Surface the logged-in account as a row so the "you" badge always shows.
  const me = mockAuthedEmail()
  const list = users.map(u => ({ ...u }))
  if (me && !list.some(u => u.email === me)) {
    list.unshift({ email: me, fullName: 'You', userType: 'ADMIN', scope: 'system', appNameUserType: { system: 'ADMIN' } })
  }
  return list
})

registerMock('POST', '/rest/v2/users', ({ body }) => {
  const u = body as User | undefined
  if (!u?.email) return { success: false, message: 'E-mail is required.' }
  if (users.some(x => x.email === u.email)) return { success: false, message: 'A user with this e-mail already exists.' }
  users.push({ email: u.email, firstName: u.firstName, lastName: u.lastName, userType: u.userType, scope: u.scope, appNameUserType: u.appNameUserType })
  return { success: true }
})

registerMock('PUT', '/rest/v2/users', ({ body }) => {
  const u = body as User | undefined
  const idx = users.findIndex(x => x.email === u?.email)
  if (idx < 0) return { success: false, message: 'User not found.' }
  users[idx] = { ...users[idx], userType: u!.userType, scope: u!.scope, appNameUserType: u!.appNameUserType }
  return { success: true }
})

registerMock('DELETE', '/rest/v2/users/:username', ({ params }) => {
  const email = params.username
  if (email === mockAuthedEmail()) return { success: false, message: 'You cannot delete your own account.' }
  const idx = users.findIndex(x => x.email === email)
  if (idx < 0) return { success: false, message: 'User not found.' }
  users.splice(idx, 1)
  return { success: true }
})

registerMock('POST', '/rest/v2/users/password', ({ body }) => {
  const u = body as { newPassword?: string } | undefined
  if (!u?.newPassword) return { success: false, message: 'New password is required.' }
  return { success: true, message: 'Success' }
})
