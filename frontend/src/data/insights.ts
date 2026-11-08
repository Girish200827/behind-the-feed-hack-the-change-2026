// Insights and the weekly goal (C4). Read from Allen's A5 endpoints (GET /insights, GET /goal) in API mode;
// otherwise (demo data, or backend offline) compute the same numbers here so the pages never break.
// The local versions mirror backend/app/insights.py on purpose: same definitions, same goal template.
import type { Category, Emotion, Platform, Session } from '../types/contracts'
import type { Timeline } from './join'
import { MIN_CONFIDENCE } from '../lib/smooth'

const NEGATIVE: ReadonlySet<Emotion> = new Set(['sad', 'angry', 'fear', 'disgust'])
/** "Before" = first minute of a session, "after" = last minute (same as the backend). */
const WINDOW_S = 60
const MIN_SWITCHES_FOR_GOAL = 2

export interface Trigger {
  category: Category
  switches: number
  negative: number
  /** Share of this category's mood switches that turned negative, 0..1. */
  triggerScore: number
}

export interface PlatformMix {
  platform: Platform
  sessions: number
  minutes: number
  /** Mean valence of confident samples on this platform (computed in the frontend), if any. */
  avgValence?: number
}

export interface Insights {
  /** Where the numbers came from: Allen's API, or computed on this device. */
  source: 'api' | 'local'
  sessions: number
  triggers: Trigger[]
  platformMix: PlatformMix[]
  /** Mean of (last-minute − first-minute) valence over finished sessions, or null. */
  avgMoodChange: number | null
  longest?: { platform: Platform; minutes: number }
}

export interface WeeklyGoalInfo {
  source: 'api' | 'local'
  text: string
  category: Category | null
  triggerScore: number | null
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d
const sessionSeconds = (s: Session, now: number) => Math.max(0, (s.end ?? now) - s.start)

/** Trigger score per category, highest first (ties: more switches first). */
export function computeTriggers(timelines: Timeline[]): Trigger[] {
  const by = new Map<Category, { switches: number; negative: number }>()
  for (const t of timelines) {
    const to = new Map(t.switches.map((s) => [s.id, s.to]))
    for (const l of t.labels) {
      const emotion = to.get(l.switch_id)
      if (!emotion) continue
      const e = by.get(l.category) ?? { switches: 0, negative: 0 }
      e.switches++
      if (NEGATIVE.has(emotion)) e.negative++
      by.set(l.category, e)
    }
  }
  return [...by.entries()]
    .map(([category, e]) => ({ category, ...e, triggerScore: e.switches ? round(e.negative / e.switches) : 0 }))
    .sort((a, b) => b.triggerScore - a.triggerScore || b.switches - a.switches)
}

/** Mean confident valence per platform (frontend-only addition to the platform mix). */
export function averageValenceByPlatform(timelines: Timeline[]): Map<Platform, number> {
  const acc = new Map<Platform, { sum: number; n: number }>()
  for (const t of timelines) {
    const a = acc.get(t.session.platform) ?? { sum: 0, n: 0 }
    for (const s of t.samples) {
      if (s.confidence < MIN_CONFIDENCE) continue
      a.sum += s.valence
      a.n++
    }
    acc.set(t.session.platform, a)
  }
  const out = new Map<Platform, number>()
  acc.forEach((a, p) => a.n && out.set(p, round(a.sum / a.n)))
  return out
}

function meanValence(t: Timeline, lo: number, hi: number): number | null {
  const xs = t.samples.filter((s) => s.ts >= lo && s.ts <= hi)
  return xs.length ? xs.reduce((a, s) => a + s.valence, 0) / xs.length : null
}

/** The same numbers as GET /insights, computed from timelines. */
export function computeInsightsLocal(timelines: Timeline[], now = Date.now() / 1000): Insights {
  const changes: number[] = []
  for (const t of timelines) {
    if (t.session.end === null) continue
    const before = meanValence(t, t.session.start, t.session.start + WINDOW_S)
    const after = meanValence(t, t.session.end - WINDOW_S, t.session.end)
    if (before !== null && after !== null) changes.push(after - before)
  }
  const mix = new Map<Platform, { sessions: number; seconds: number }>()
  let longest: Insights['longest']
  for (const t of timelines) {
    const m = mix.get(t.session.platform) ?? { sessions: 0, seconds: 0 }
    const secs = sessionSeconds(t.session, now)
    m.sessions++
    m.seconds += secs
    mix.set(t.session.platform, m)
    if (!longest || secs / 60 > longest.minutes) longest = { platform: t.session.platform, minutes: round(secs / 60, 1) }
  }
  const avg = averageValenceByPlatform(timelines)
  return {
    source: 'local',
    sessions: timelines.length,
    triggers: computeTriggers(timelines),
    platformMix: [...mix.entries()]
      .map(([platform, m]) => ({ platform, sessions: m.sessions, minutes: round(m.seconds / 60, 1), avgValence: avg.get(platform) }))
      .sort((a, b) => b.minutes - a.minutes),
    avgMoodChange: changes.length ? round(changes.reduce((a, c) => a + c, 0) / changes.length) : null,
    longest
  }
}

/** The same goal as GET /goal (template text; Girish's G4 may reword it on the backend). */
export function computeGoalLocal(ins: Insights): WeeklyGoalInfo {
  const top = ins.triggers.find((t) => t.switches >= MIN_SWITCHES_FOR_GOAL && t.negative > 0)
  if (top) {
    const pct = Math.round(top.triggerScore * 100)
    return {
      source: 'local',
      category: top.category,
      triggerScore: top.triggerScore,
      text: `Your mood dipped after ${pct}% of the ${top.category} posts you saw. This week, try capping ${top.category} content to 10 minutes a day.`
    }
  }
  if (ins.longest && ins.longest.minutes >= 20) {
    return {
      source: 'local',
      category: null,
      triggerScore: null,
      text: `Your longest scroll was ${Math.round(ins.longest.minutes)} minutes on ${ins.longest.platform}. This week, try stopping each session at 15 minutes.`
    }
  }
  return {
    source: 'local',
    category: null,
    triggerScore: null,
    text: 'Not enough data yet. Scroll as you normally would and check back after a few sessions.'
  }
}

// ── Adapters for Allen's responses (backend/app/insights.py) ─────────────────────────────

export interface ApiInsights {
  triggers?: { category: Category; switches: number; negative: number; trigger_score: number }[]
  avg_mood_change?: number | null
  platform_mix?: { platform: Platform; sessions: number; minutes: number }[]
  longest_session?: { platform: Platform; minutes: number } | null
  sessions?: unknown[]
}

export function fromApiInsights(raw: ApiInsights, avgByPlatform: Map<Platform, number>, sessionCount: number): Insights {
  return {
    source: 'api',
    sessions: sessionCount,
    triggers: (raw.triggers ?? []).map((t) => ({ category: t.category, switches: t.switches, negative: t.negative, triggerScore: t.trigger_score })),
    platformMix: (raw.platform_mix ?? []).map((p) => ({ ...p, avgValence: avgByPlatform.get(p.platform) })),
    avgMoodChange: raw.avg_mood_change ?? null,
    longest: raw.longest_session ? { platform: raw.longest_session.platform, minutes: raw.longest_session.minutes } : undefined
  }
}

export interface ApiGoal {
  text?: string
  category?: Category | null
  trigger_score?: number | null
}

export const fromApiGoal = (raw: ApiGoal): WeeklyGoalInfo | null =>
  typeof raw.text === 'string' && raw.text.trim()
    ? { source: 'api', text: raw.text, category: raw.category ?? null, triggerScore: raw.trigger_score ?? null }
    : null
