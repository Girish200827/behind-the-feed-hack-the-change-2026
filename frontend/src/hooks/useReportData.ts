import { getSessions, getTimeline, type Timeline } from '../data'
import { POLL_LIVE_MS, POLL_SESSIONS_MS } from '../data/constants'
import type { Session } from '../types/contracts'
import { usePolled, type Load } from './usePolled'
import { timelineSig } from './useDay'

/** All sessions, refreshed every 5 s so new and ended sessions show up. */
export function useSessions(): Load<Session[]> {
  return usePolled('sessions', getSessions, {
    signature: (list) => list.map((s) => `${s.id}:${s.end}`).join('|'),
    interval: () => POLL_SESSIONS_MS
  })
}

/** One session's timeline, refreshed every 2 s while the session is still live. */
export function useTimeline(sessionId: string | undefined): Load<Timeline | null> {
  return usePolled(sessionId, () => getTimeline(sessionId ?? ''), {
    signature: (t) => (t ? timelineSig(t) : 'none'),
    interval: (t) => (t && t.session.end === null ? POLL_LIVE_MS : null)
  })
}
