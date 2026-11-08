// Allen's local API (A4). His timeline uses the key "emotions" where our Timeline type says "samples";
// the adapter below maps it, so components never see the difference. Every event is validated against the
// contract types on the way in; anything malformed is dropped (and logged) instead of breaking the charts.
import { API_BASE_URL, API_PATHS, API_TIMEOUT_MS } from './constants'
import { sortSessions, type Timeline } from './join'
import { detectEvent } from './loader'
import type { DataSource } from './source'
import type { ContextLabel, EmotionSample, MoodSwitch, Session } from '../types/contracts'

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the backend could not be reached at all. */
    readonly status: number
  ) {
    super(message)
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal })
    if (!res.ok) throw new ApiError(`API ${path} returned ${res.status}`, res.status)
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(`Backend not reachable at ${API_BASE_URL}`, 0)
  } finally {
    clearTimeout(timer)
  }
}

/** The shape of GET /sessions/{id}/timeline (backend/app/models.py, Timeline). */
export interface ApiTimeline {
  session: unknown
  emotions?: unknown[]
  switches?: unknown[]
  labels?: unknown[]
}

/** Adapter: Allen's timeline → our Timeline. Validates every item against the contract formats. */
export function fromApiTimeline(raw: ApiTimeline): Timeline | null {
  const s = detectEvent(raw.session)
  if (typeof s === 'string' || s.kind !== 'session') {
    console.warn('[api] timeline has an invalid session', raw.session)
    return null
  }
  const pick = <K extends 'emotion_sample' | 'mood_switch' | 'context_label'>(items: unknown[] | undefined, kind: K) => {
    const out: unknown[] = []
    for (const item of items ?? []) {
      const r = detectEvent(item)
      if (typeof r !== 'string' && r.kind === kind) out.push(r.event)
      else console.warn(`[api] dropped invalid ${kind}`, item)
    }
    return out
  }
  return {
    session: s.event,
    samples: pick(raw.emotions, 'emotion_sample') as EmotionSample[],
    switches: pick(raw.switches, 'mood_switch') as MoodSwitch[],
    labels: pick(raw.labels, 'context_label') as ContextLabel[]
  }
}

export const ApiSource: DataSource = {
  async getSessions() {
    const raw = await getJson<unknown[]>(API_PATHS.sessions)
    const sessions: Session[] = []
    for (const item of raw) {
      const r = detectEvent(item)
      if (typeof r !== 'string' && r.kind === 'session') sessions.push(r.event)
      else console.warn('[api] dropped invalid session', item)
    }
    return sortSessions(sessions)
  },
  async getTimeline(sessionId) {
    try {
      return fromApiTimeline(await getJson<ApiTimeline>(API_PATHS.timeline(sessionId)))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  }
}

/** GET /status: is a social platform in front right now? null if the backend can't be reached. */
export async function getScrollingStatus(): Promise<{ scrolling: boolean } | null> {
  try {
    const s = await getJson<{ scrolling?: unknown }>(API_PATHS.status)
    return { scrolling: s.scrolling === true }
  } catch {
    return null
  }
}
