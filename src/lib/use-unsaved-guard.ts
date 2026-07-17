import { useEffect } from 'react'
import { useBlocker, type Blocker } from 'react-router'

// Guards against losing unsaved edits. Covers two of the three exits:
//  - in-app route navigation → blocks it and returns the router Blocker so the
//    caller can prompt (proceed()/reset()).
//  - browser close / hard refresh → native beforeunload prompt.
// The third exit (switching between local tabs that aren't real navigations)
// can't be seen from here; the owner of that tab state gates it (see AppDetailPage).
export function useUnsavedGuard(dirty: boolean): Blocker {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
}
