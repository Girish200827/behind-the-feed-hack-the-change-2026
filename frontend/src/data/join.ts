// Joins events to sessions BY TIME (start <= ts <= end); labels attach to switches by switch_id.
import type { ContextLabel, EmotionSample, MoodSwitch, Session } from '../types/contracts'

export interface Timeline {
  session: Session
  samples: EmotionSample[]
  switches: MoodSwitch[]
  labels: ContextLabel[]
}

const inSession = (s: Session) => (e: { ts: number }) => e.ts >= s.start && e.ts <= s.end
const byTs = (a: { ts: number }, b: { ts: number }) => a.ts - b.ts

export function buildTimeline(
  session: Session,
  all: { samples: EmotionSample[]; switches: MoodSwitch[]; labels: ContextLabel[] }
): Timeline {
  const switches = all.switches.filter(inSession(session)).sort(byTs)
  const ids = new Set(switches.map((s) => s.id))
  return {
    session,
    samples: all.samples.filter(inSession(session)).sort(byTs),
    switches,
    labels: all.labels.filter((l) => ids.has(l.switch_id))
  }
}

/** The label for a switch, or undefined if the screen labeller hasn't sent one yet. */
export function labelFor(timeline: Timeline, switchId: string): ContextLabel | undefined {
  return timeline.labels.find((l) => l.switch_id === switchId)
}

/** Newest session first. */
export const sortSessions = (sessions: Session[]) => [...sessions].sort((a, b) => b.start - a.start)
