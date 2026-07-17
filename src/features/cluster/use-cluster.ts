import { useApi } from '@/lib/api'
import { cluster } from '@/lib/api/endpoints'
import { parseNode } from './parse'
import type { NodeView } from './types'

// System-scoped, base `api` client. One poll fetches cluster-mode-status (to tell
// "standalone" apart from "in cluster, no nodes yet") and the node list together.
// Poll cadence matches the node heartbeat period (5s); a node goes dead at 20s.

const POLL_MS = 5000
const NODE_FETCH_SIZE = 1000 // basic view fetches all; clusters are small. Pagination → FUTURE.

type ClusterData = { inCluster: boolean; nodes: NodeView[] }

export function useCluster() {
  const { data, error, isLoading, isFetching, refresh } = useApi<ClusterData>(
    async signal => {
      // The node endpoints 500 on a standalone server (no cluster store), so gate on
      // cluster mode first and skip them entirely when not clustered.
      const mode = await cluster.modeStatus(signal)
      if (!mode?.success) return { inCluster: false, nodes: [] }
      const raw = await cluster.nodes(0, NODE_FETCH_SIZE, signal)
      return { inCluster: true, nodes: (raw ?? []).map(parseNode) }
    },
    { pollMs: POLL_MS },
  )

  return {
    inCluster: data?.inCluster ?? false,
    nodes: data?.nodes ?? [],
    error,
    isLoading,
    isFetching,
    refresh,
    saveNote: cluster.saveNote, // real PUT /cluster/node/{id}/note; mock kept for offline dev
  }
}
