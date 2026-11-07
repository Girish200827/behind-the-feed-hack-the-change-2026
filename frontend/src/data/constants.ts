// Allen's local API (task A4). Base URL and paths are placeholders.
// TODO: confirm with Allen and check they match contracts.md before Phase 3.
export const API_BASE_URL = 'http://localhost:8000'

export const API_PATHS = {
  sessions: '/sessions',
  timeline: (sessionId: string) => `/sessions/${encodeURIComponent(sessionId)}/timeline`
} as const

export type DataSourceName = 'mock' | 'api'

export const DATA_SOURCE: DataSourceName = import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock'
