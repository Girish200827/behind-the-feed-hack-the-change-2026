// The one entry point for data. Components import from here and nowhere else.
import { ApiSource, getJson, getScrollingStatus } from './apiSource'
import { API_PATHS, DATA_SOURCE } from './constants'
import {
  averageValenceByPlatform,
  computeGoalLocal,
  computeInsightsLocal,
  fromApiGoal,
  fromApiInsights,
  type ApiGoal,
  type ApiInsights,
  type Insights,
  type WeeklyGoalInfo
} from './insights'
import type { Timeline } from './join'
import { getDayFrom, type DayKey } from './day'
import { GoalService } from './goals'
import { CameraControl, type CameraStatus } from './camera'
import { MockSource } from './mockSource'
import { ResilientSource } from './resilientSource'
import type { DataSource } from './source'

// API mode reads Allen's local API and falls back to the demo data if it can't be reached.
const resilient = DATA_SOURCE === 'api' ? new ResilientSource(ApiSource, MockSource) : null
const source: DataSource = resilient ?? MockSource

export const getSessions = () => source.getSessions()
export const getTimeline = (sessionId: string) => source.getTimeline(sessionId)
/** All sessions that started on a local day, oldest first, with their timelines. */
export const getDay = (date: DayKey) => getDayFrom(source, date)
export const dataSourceName = DATA_SOURCE

/** API mode: true when Allen's backend answers, false when we fell back to demo data, null before the first try. */
export const backendOnline = () => resilient?.isOnline() ?? null
export const onBackendChange = (fn: (online: boolean) => void) => resilient?.onChange(fn) ?? (() => {})

// Insights and weekly goal (C4): Allen's A5 endpoints when reachable, otherwise computed here from the same data.
async function allTimelines(): Promise<Timeline[]> {
  const sessions = await source.getSessions()
  const timelines = await Promise.all(sessions.map((s) => source.getTimeline(s.id)))
  return timelines.filter((t): t is Timeline => t !== null)
}

export async function getInsights(): Promise<Insights> {
  const timelines = await allTimelines() // also tells us whether the backend is up
  if (resilient?.isOnline()) {
    try {
      const raw = await getJson<ApiInsights>(API_PATHS.insights)
      return fromApiInsights(raw, averageValenceByPlatform(timelines), timelines.length)
    } catch {
      // fall through to the local computation
    }
  }
  return computeInsightsLocal(timelines)
}

export async function getWeeklyGoal(): Promise<WeeklyGoalInfo> {
  if (resilient && resilient.isOnline() !== false) {
    try {
      const goal = fromApiGoal(await getJson<ApiGoal>(API_PATHS.goal))
      if (goal) return goal
    } catch {
      // fall through
    }
  }
  return computeGoalLocal(await getInsights())
}
export type { Insights, PlatformMix, Trigger, WeeklyGoalInfo } from './insights'

// Camera status and pause/resume (in memory until the pause endpoint is in contracts.md).
const camera = new CameraControl(source, resilient ? getScrollingStatus : undefined)
export const getStatus = () => camera.getStatus()
export const pause = () => camera.pause()
export const resume = () => camera.resume()
export const onCameraStatusChange = (fn: (s: CameraStatus) => void) => camera.onChange(fn)
export type { CameraStatus }

// First-launch consent.
export { giveConsent, hasConsented, resetConsent } from './consent'

// Daily goal (frontend-only), check-ins and week comparison.
const goals = new GoalService(source, DATA_SOURCE)
export const getDailyGoal = (date: DayKey) => goals.getDailyGoal(date)
export const setCheckIn = (date: DayKey, value: boolean) => goals.setCheckIn(date, value)
export const getWeekComparison = (date: DayKey) => goals.getWeekComparison(date)

export { labelFor, type Timeline } from './join'
// Support nearby (Open Referral HSDS).
export { getSupportResources, type SupportResource } from './support'

// Connect-instead nudges: preferences and native notifications.
export { markStretchSeen, notifyNative, nudgesEnabled, setNudgesEnabled, takeSuggestionIndex } from './nudgeSettings'

// Scroll Circle (Discord webhook via the main process).
export {
  getCircleSettings,
  getSampleCircleFeed,
  getSentLog,
  saveCircleSettings,
  shareToCircle,
  type CircleSample,
  type CircleSettings,
  type SentItem
} from './circle'
export type { DailyGoal, GoalProgress, GoalStatus, GoalType } from './dailyGoal'
export type { DailyGoalView, WeekComparison } from './goals'
export { addDays, dayEnd, dayKey, dayStart, isDayKey, todayKey, type Day, type DayKey } from './day'
