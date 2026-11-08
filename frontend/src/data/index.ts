// The one entry point for data. Components import from here and nowhere else.
import { ApiSource } from './apiSource'
import { DATA_SOURCE } from './constants'
import { getDayFrom, type DayKey } from './day'
import { GoalService } from './goals'
import { MockSource } from './mockSource'
import type { DataSource } from './source'

const source: DataSource = DATA_SOURCE === 'api' ? ApiSource : MockSource

export const getSessions = () => source.getSessions()
export const getTimeline = (sessionId: string) => source.getTimeline(sessionId)
/** All sessions that started on a local day, oldest first, with their timelines. */
export const getDay = (date: DayKey) => getDayFrom(source, date)
export const dataSourceName = DATA_SOURCE

// Daily goal (frontend-only), check-ins and week comparison.
const goals = new GoalService(source, DATA_SOURCE)
export const getDailyGoal = (date: DayKey) => goals.getDailyGoal(date)
export const setCheckIn = (date: DayKey, value: boolean) => goals.setCheckIn(date, value)
export const getWeekComparison = (date: DayKey) => goals.getWeekComparison(date)

export { labelFor, type Timeline } from './join'
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
