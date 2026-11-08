import { createContext, useContext, type ReactNode } from 'react'
import { useConnectionStatus } from '@/contexts/connection-context'
import { useApi } from '@/lib/api/use-api'
import { server } from '@/lib/api/endpoints'

// `false` only when the server answered Community. Anything else (in flight, failed, malformed, no
// provider) is Enterprise: a lost probe must never lock out a paying user.
export const EditionContext = createContext(true)

// No poll, the edition can't change without a restart. Refetch on reconnect recovers a lost probe.
export function EditionProvider({ children }: { children: ReactNode }) {
  const { status } = useConnectionStatus()
  const { data } = useApi(signal => server.enterpriseEdition(signal), { enabled: status === 'connected' })
  return <EditionContext.Provider value={data?.success !== false}>{children}</EditionContext.Provider>
}

export function useEnterprise() {
  return useContext(EditionContext)
}
