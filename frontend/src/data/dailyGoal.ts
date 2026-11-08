// Daily social well-being goal: pure functions, no storage and no fetching (see goals.ts for that).
// Frontend-only. The weekly goal from Allen's A5 / Girish's G4 is separate.
//
// Flow: yesterday's sessions → computeDayStats → selectDailyGoal → today's goal.
//       today's sessions + check-in → evaluateGoal → status and progress.
//       per-day results → countStreak.
import type { Category, Platform } from '../types/contracts'
import type { Timeline } from './join'
import { addDays, type DayKey } from './day'
import { DAY_SMOOTH_WINDOW_S, smoothSamples } from '../lib/smooth'
import { avgValence, biggestShiftsAcross, drainedSeconds } from '../lib/mood'
import { platformName } from '../lib/format'

/** Late night starts at 11 PM (and runs until 4 AM). */
export const LATE_NIGHT_HOUR = 23
const LATE_NIGHT_END_HOUR = 4
/** "Keep draining content under 15 min today". */
export const DRAIN_LIMIT_S = 15 * 60
/** Drained for at least this share of scroll time counts as a heavy day. */
export const HIGH_DRAIN_SHARE = 0.4

export interface DayStats {
  sessions: number
  /** Total scroll time (s). */
  totalSeconds: number
  /** Time spent below neutral mood, on smoothed confident samples (s). */
  drainedSeconds: number
  /** Time covered by confident samples (s). */
  sampledSeconds: number
  /** drainedSeconds / sampledSeconds, 0..1. */
  drainedShare: number
  /** Platform with the most drained time. */
  mostDrainingPlatform?: Platform
  /** Category with the biggest single mood lift, and the biggest drop (with its platform). */
  liftCategory?: Category
  drainCategory?: Category
  drainPlatform?: Platform
  /** Sessions that started at or after 11 PM (or before 4 AM). */
  lateNightSessions: number
  /** Late-night sessions that left you mostly drained. */
  lateNightDrained: number
  lateNightPlatform?: Platform
}

export const isLateNight = (ts: number) => {
  const h = new Date(ts * 1000).getHours()
  return h >= LATE_NIGHT_HOUR || h < LATE_NIGHT_END_HOUR
}

/** Summarises one day's sessions. Uses the same smoothing as the day ribbon so numbers match what people see. */
export function computeDayStats(timelines: Timeline[]): DayStats {
  const items = timelines.map((t) => ({ timeline: t, samples: smoothSamples(t.samples, DAY_SMOOTH_WINDOW_S) }))
  let totalSeconds = 0
  let drained = 0
  let span = 0
  let lateNightSessions = 0
  let lateNightDrained = 0
  let lateNightPlatform: Platform | undefined
  const drainedBy = new Map<Platform, number>()

  for (const { timeline: t, samples } of items) {
    const last = t.samples.length ? t.samples[t.samples.length - 1].ts : t.session.start
    totalSeconds += Math.max(0, (t.session.end ?? last) - t.session.start)
    const d = drainedSeconds(samples)
    drained += d.below
    span += d.span
    drainedBy.set(t.session.platform, (drainedBy.get(t.session.platform) ?? 0) + d.below)
    if (isLateNight(t.session.start)) {
      lateNightSessions++
      const share = d.span > 0 ? d.below / d.span : 0
      if (share > 0.5 || (avgValence(samples) ?? 0) < -0.1) {
        lateNightDrained++
        lateNightPlatform = t.session.platform
      }
    }
  }

  const { lift, drain } = biggestShiftsAcross(items)
  const mostDrainingPlatform = [...drainedBy.entries()].sort((a, b) => b[1] - a[1]).find(([, s]) => s > 0)?.[0]
  return {
    sessions: timelines.length,
    totalSeconds,
    drainedSeconds: drained,
    sampledSeconds: span,
    drainedShare: span > 0 ? drained / span : 0,
    mostDrainingPlatform,
    liftCategory: lift?.category,
    drainCategory: drain?.category,
    drainPlatform: drain?.platform,
    lateNightSessions,
    lateNightDrained,
    lateNightPlatform
  }
}

export type GoalType = 'connection' | 'limit' | 'timing'

export interface DailyGoal {
  /** Stable id for the wording, e.g. "connection-swap". */
  id: string
  type: GoalType
  title: string
  /** One line: why this goal was picked. */
  why: string
  /** Connection goals are met with a one-tap check-in. */
  needsCheckIn: boolean
  /** Limit goals: allowed drained time (s). */
  limitSeconds?: number
}

const pct = (share: number) => `${Math.round(share * 100)}%`

/**
 * Picks today's goal from yesterday's stats. Order of preference:
 *  1. Connection (swap a session) when friends content was the biggest lift, since people help more than feeds.
 *  2. Timing (no scrolling after 11 PM) when a late-night session drained your mood.
 *  3. Connection (message a friend first) when drained time was high.
 *  4. Limit (draining content under 15 min) otherwise, naming the top draining category and platform.
 * With no data for yesterday, a gentle connection goal.
 */
export function selectDailyGoal(prev: DayStats | null): DailyGoal {
  if (!prev || prev.sessions === 0) {
    return {
      id: 'connection-swap',
      type: 'connection',
      title: 'Swap one scroll session for a call or text',
      why: 'No scrolling recorded yesterday. Start today with people, not feeds.',
      needsCheckIn: true
    }
  }
  if (prev.liftCategory === 'friends') {
    return {
      id: 'connection-swap',
      type: 'connection',
      title: 'Swap one scroll session for a call or text',
      why: 'Posts from friends lifted you most yesterday. The real conversation tends to lift you even more.',
      needsCheckIn: true
    }
  }
  if (prev.lateNightDrained > 0) {
    const where = prev.lateNightPlatform ? ` on ${platformName(prev.lateNightPlatform)}` : ''
    return {
      id: 'timing-11pm',
      type: 'timing',
      title: 'No scrolling after 11 PM',
      why: `Late-night scrolling${where} left you drained yesterday.`,
      needsCheckIn: false
    }
  }
  if (prev.drainedShare >= HIGH_DRAIN_SHARE && prev.mostDrainingPlatform) {
    const p = platformName(prev.mostDrainingPlatform)
    return {
      id: 'connection-message-first',
      type: 'connection',
      title: `Message a friend before opening ${p}`,
      why: `You felt drained for ${pct(prev.drainedShare)} of your scroll time yesterday, mostly on ${p}.`,
      needsCheckIn: true
    }
  }
  const cat = prev.drainCategory ?? 'draining'
  const where = prev.drainPlatform ? ` on ${platformName(prev.drainPlatform)}` : ''
  return {
    id: 'limit-15',
    type: 'limit',
    title: 'Keep draining content under 15 min today',
    why: prev.drainCategory ? `Yesterday, ${cat} content${where} brought your mood down the most.` : 'A small daily limit keeps the drain in check.',
    needsCheckIn: false,
    limitSeconds: DRAIN_LIMIT_S
  }
}

export type GoalStatus = 'met' | 'on-track' | 'pending' | 'missed'

export interface GoalProgress {
  status: GoalStatus
  /** 0..1 for the progress ring. */
  progress: number
  /** Short line under the goal, e.g. "6 of 15 min used". */
  detail: string
}

/**
 * How the goal is going for a day.
 * `complete`: the day is over (past days), so "on track" becomes "met" and "pending" becomes "missed".
 */
export function evaluateGoal(goal: DailyGoal, stats: DayStats, opts: { checkedIn: boolean; complete: boolean }): GoalProgress {
  if (goal.type === 'connection') {
    if (opts.checkedIn) return { status: 'met', progress: 1, detail: 'You reached out to someone. Nice.' }
    return opts.complete
      ? { status: 'missed', progress: 0, detail: 'No check-in that day.' }
      : { status: 'pending', progress: 0, detail: 'Tap check in once you have.' }
  }
  if (goal.type === 'limit') {
    const limit = goal.limitSeconds ?? DRAIN_LIMIT_S
    const used = stats.drainedSeconds
    const mins = `${Math.round(used / 60)} of ${Math.round(limit / 60)} min used`
    if (used > limit) return { status: 'missed', progress: 1, detail: `${mins}. Tomorrow is a fresh start.` }
    return { status: opts.complete ? 'met' : 'on-track', progress: used / limit, detail: mins }
  }
  // timing
  if (stats.lateNightSessions > 0) return { status: 'missed', progress: 1, detail: 'Scrolled after 11 PM.' }
  return opts.complete
    ? { status: 'met', progress: 1, detail: 'No scrolling after 11 PM.' }
    : { status: 'on-track', progress: 1, detail: 'No late-night scrolling so far.' }
}

/**
 * Consecutive days the goal was met, counting back from yesterday, plus today if it's already met.
 * `results` holds final results for finished days (true = met).
 */
export function countStreak(results: Record<DayKey, boolean>, today: DayKey, todayMet: boolean): number {
  let n = 0
  for (let d = addDays(today, -1); results[d] === true; d = addDays(d, -1)) n++
  return n + (todayMet ? 1 : 0)
}
