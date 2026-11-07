// Stub for Allen's local API (task A4). Finished in Phase 3 once endpoints and response shapes are
// confirmed and in contracts.md. If his shape differs from our types, add an adapter here, not in components.
import { API_BASE_URL, API_PATHS } from './constants'
import { sortSessions, type Timeline } from './join'
import type { DataSource } from './source'
import type { Session } from '../types/contracts'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`)
  return (await res.json()) as T
}

export const ApiSource: DataSource = {
  async getSessions() {
    return sortSessions(await getJson<Session[]>(API_PATHS.sessions))
  },
  async getTimeline(sessionId) {
    // TODO(Phase 3): confirm Allen's timeline response shape; adapt here if needed.
    return getJson<Timeline>(API_PATHS.timeline(sessionId))
  }
}
