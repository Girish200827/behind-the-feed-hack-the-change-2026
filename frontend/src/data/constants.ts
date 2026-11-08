// Allen's local API (A4), as documented in backend/README.md.
// 127.0.0.1 rather than localhost: on Windows "localhost" can resolve to IPv6 (::1) while uvicorn listens on IPv4.
// Override with VITE_API_URL (the Content-Security-Policy in index.html must allow it too).
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export const API_PATHS = {
  /** GET: all sessions, newest first. */
  sessions: '/sessions',
  /** GET: { session, emotions, switches, labels } ordered by time. */
  timeline: (sessionId: string) => `/sessions/${encodeURIComponent(sessionId)}/timeline`,
  /** GET: { scrolling, session_id, platform, ... }. Used for the camera status pill. */
  status: '/status',
  /** GET (A5): trigger scores, session moods, platform mix, longest session. */
  insights: '/insights',
  /** GET (A5): one weekly goal from the top trigger. */
  goal: '/goal'
} as const

/** Give up on a request after this long and treat the backend as offline. */
export const API_TIMEOUT_MS = 2500
/** Phase 3 polling: the session list every 5 s; an open timeline every 2 s while its session is live. */
export const POLL_SESSIONS_MS = 5000
export const POLL_LIVE_MS = 2000

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
