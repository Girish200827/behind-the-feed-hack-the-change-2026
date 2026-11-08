// The one entry point for data. Components import from here and nowhere else.
import { ApiSource } from './apiSource'
import { DATA_SOURCE } from './constants'
import { getDayFrom, type DayKey } from './day'
import { GoalService } from './goals'
import { CameraControl, type CameraStatus } from './camera'
import { MockSource } from './mockSource'
import type { DataSource } from './source'

const source: DataSource = DATA_SOURCE === 'api' ? ApiSource : MockSource

export const getSessions = () => source.getSessions()
export const getTimeline = (sessionId: string) => source.getTimeline(sessionId)
/** All sessions that started on a local day, oldest first, with their timelines. */
export const getDay = (date: DayKey) => getDayFrom(source, date)
export const dataSourceName = DATA_SOURCE

// Camera status and pause/resume (in memory until the pause endpoint is in contracts.md).
const camera = new CameraControl(source)
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
