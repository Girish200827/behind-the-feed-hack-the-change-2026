// Daily goal service: loads days through the data source, keeps check-ins and per-day results on this device,
// and returns everything the goal card needs. The goal logic itself lives in dailyGoal.ts (pure).
import type { Category, Platform } from '../types/contracts'
import { addDays, getDayFrom, todayKey, type DayKey } from './day'
import {
  computeDayStats,
  countStreak,
  evaluateGoal,
  selectDailyGoal,
  type DailyGoal,
  type DayStats,
  type GoalProgress
} from './dailyGoal'
import { KEYS, readJson, writeJson } from './localStore'
import type { DataSource } from './source'

/** How far back finished days are scored for the streak. */
const HISTORY_DAYS = 13

export interface DailyGoalView {
  date: DayKey
  goal: DailyGoal
  progress: GoalProgress
  checkedIn: boolean
  /** Consecutive days met, including today once it's met. */
  streak: number
}

export class GoalService {
  private statsCache = new Map<DayKey, Promise<DayStats>>()

  constructor(
    private source: DataSource,
    private sourceName: string
  ) {}

  private stats(date: DayKey): Promise<DayStats> {
    // Today's stats change during the day; past days are cached.
    if (date === todayKey()) return getDayFrom(this.source, date).then((d) => computeDayStats(d.timelines))
    let p = this.statsCache.get(date)
    if (!p) {
      p = getDayFrom(this.source, date).then((d) => computeDayStats(d.timelines))
      this.statsCache.set(date, p)
    }
    return p
  }

  checkins(): Record<DayKey, boolean> {
    return readJson<Record<DayKey, boolean>>(KEYS.checkins, {})
  }

  /** One-tap "I reached out to someone today". Stored on this device only. */
  setCheckIn(date: DayKey, value: boolean) {
    const all = this.checkins()
    if (value) all[date] = true
    else delete all[date]
    writeJson(KEYS.checkins, all)
  }

  private history(): Record<DayKey, boolean> {
    return readJson<Record<DayKey, boolean>>(KEYS.goalHistory(this.sourceName), {})
  }

  /**
   * Demo only (mock data): the first time, record the last 4 finished days as met and the day before as missed,
   * so the demo shows a 4-day streak. Real data is scored from sessions and check-ins.
   */
  private seedDemoHistory(today: DayKey) {
    const h = this.history()
    if (Object.keys(h).length) return
    for (let i = 1; i <= 4; i++) h[addDays(today, -i)] = true
    h[addDays(today, -5)] = false
    writeJson(KEYS.goalHistory(this.sourceName), h)
  }

  /** Scores finished days that have no stored result yet (goal from the day before, sessions + check-ins of that day). */
  private async scoreHistory(today: DayKey): Promise<Record<DayKey, boolean>> {
    if (this.sourceName === 'mock') this.seedDemoHistory(today)
    const history = this.history()
    const checkins = this.checkins()
    let changed = false
    for (let i = 1; i <= HISTORY_DAYS; i++) {
      const d = addDays(today, -i)
      if (d in history) continue
      const [prev, stats] = await Promise.all([this.stats(addDays(d, -1)), this.stats(d)])
      if (stats.sessions === 0 && !checkins[d]) continue // nothing to score
      const goal = selectDailyGoal(prev)
      history[d] = evaluateGoal(goal, stats, { checkedIn: !!checkins[d], complete: true }).status === 'met'
      changed = true
    }
    if (changed) writeJson(KEYS.goalHistory(this.sourceName), history)
    return history
  }

  async getDailyGoal(date: DayKey): Promise<DailyGoalView> {
    const today = todayKey()
    const [prev, stats] = await Promise.all([this.stats(addDays(date, -1)), this.stats(date)])
    const goal = selectDailyGoal(prev)
    const checkedIn = !!this.checkins()[date]
    const progress = evaluateGoal(goal, stats, { checkedIn, complete: date < today })
    const history = await this.scoreHistory(today)
    const todayMet = date === today ? progress.status === 'met' : !!this.checkins()[today]
    return { date, goal, progress, checkedIn, streak: countStreak(history, today, todayMet) }
  }

  /** This week (7 days ending `date`) against the 7 days before it. */
  async getWeekComparison(date: DayKey): Promise<WeekComparison> {
    const sum = async (from: number) => {
      const days = await Promise.all(Array.from({ length: 7 }, (_, i) => this.stats(addDays(date, -(from + i)))))
      const total = days.reduce((a, d) => a + d.totalSeconds, 0)
      const drained = days.reduce((a, d) => a + d.drainedSeconds, 0)
      const sampled = days.reduce((a, d) => a + d.sampledSeconds, 0)
      return { total, drained, share: sampled > 0 ? drained / sampled : 0, days }
    }
    const [thisWeek, lastWeek] = await Promise.all([sum(0), sum(7)])
    return {
      thisWeekDrainedShare: thisWeek.share,
      thisWeekDrainedSeconds: thisWeek.drained,
      lastWeekDrainedSeconds: lastWeek.drained,
      drainedChange: lastWeek.drained > 0 ? (thisWeek.drained - lastWeek.drained) / lastWeek.drained : null,
      topDrain: topOf(thisWeek.days.map((d) => d.drainCategory && d.drainPlatform && { c: d.drainCategory, p: d.drainPlatform })),
      topLift: topOf(thisWeek.days.map((d) => d.liftCategory && { c: d.liftCategory }))?.c
    }
  }
}

export interface WeekComparison {
  /** Share of this week's sampled scroll time spent below neutral (0..1). */
  thisWeekDrainedShare: number
  thisWeekDrainedSeconds: number
  lastWeekDrainedSeconds: number
  /** Relative change in drained time vs last week (-0.2 = 20% less), or null without last-week data. */
  drainedChange: number | null
  /** Most frequent biggest-drain category (and its platform) this week. */
  topDrain?: { c: Category; p?: Platform }
  topLift?: Category
}

function topOf<T extends { c: Category; p?: Platform }>(xs: (T | undefined | false | '')[]): T | undefined {
  const counts = new Map<string, { item: T; n: number }>()
  for (const x of xs) {
    if (!x) continue
    const k = `${x.c}|${x.p ?? ''}`
    const e = counts.get(k) ?? { item: x, n: 0 }
    e.n++
    counts.set(k, e)
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.item
}
