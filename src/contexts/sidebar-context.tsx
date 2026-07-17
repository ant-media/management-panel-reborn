import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

// Lets a deep feature (e.g. the streams drawer) collapse the chrome sidebar to
// reclaim width. No-op default so it's safe outside ProtectedLayout.
type SidebarContextValue = {
  collapsed: boolean
  setCollapsed: Dispatch<SetStateAction<boolean>>
}

export const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}
