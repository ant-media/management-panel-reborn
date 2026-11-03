import { Navigate, useParams } from 'react-router'

// The classic console's `#/applications/:name` (see router.tsx).
export function ClassicAppRedirect() {
  const { name = '' } = useParams()
  return <Navigate to={`/apps/${encodeURIComponent(name)}`} replace />
}
