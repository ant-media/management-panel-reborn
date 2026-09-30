import { createContext, useContext, type ReactNode } from 'react'
import { useConnectionStatus } from '@/contexts/connection-context'
import { useApi } from '@/lib/api/use-api'
import { server } from '@/lib/api/endpoints'

// null = not known yet (in flight, failed, or no provider). Only `false` may lock anything,
// a lost probe must never lock out a paying user.
export const EditionContext = createContext<boolean | null>(null)

// No poll, the edition can't change without a restart. Refetch on reconnect recovers a lost probe.
export function EditionProvider({ children }: { children: ReactNode }) {
  const { status } = useConnectionStatus()
  const { data } = useApi(signal => server.enterpriseEdition(signal), { refetchKey: status })
  return <EditionContext.Provider value={data ? data.success : null}>{children}</EditionContext.Provider>
}

export function useEnterprise() {
  return useContext(EditionContext)
}
