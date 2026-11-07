// Allen's local API (task A4). Base URL and paths are placeholders.
// TODO: confirm with Allen and check they match contracts.md before Phase 3.
export const API_BASE_URL = 'http://localhost:8000'

export const API_PATHS = {
  sessions: '/sessions',
  timeline: (sessionId: string) => `/sessions/${encodeURIComponent(sessionId)}/timeline`
} as const

export type DataSourceName = 'mock' | 'api'

export const DATA_SOURCE: DataSourceName = import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock'

/**
 * Which files in src/mock/ the mock source reads (names without extension, comma-separated).
 * "all" (default) = every top-level file, "none" = no files (empty state).
 * Examples: VITE_MOCK_FILE=realistic   VITE_MOCK_FILE=events,live   VITE_MOCK_FILE=edge/no-samples
 */
export const MOCK_FILES: string[] | 'all' = (() => {
  const raw = (import.meta.env.VITE_MOCK_FILE ?? 'all').trim()
  if (raw === '' || raw === 'all') return 'all'
  if (raw === 'none') return []
  return raw.split(',').map((s: string) => s.trim()).filter(Boolean)
})()
