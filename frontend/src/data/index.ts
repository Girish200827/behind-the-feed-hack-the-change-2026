// The one entry point for data. Components import from here and nowhere else.
import { ApiSource } from './apiSource'
import { DATA_SOURCE } from './constants'
import { getDayFrom, type DayKey } from './day'
import { MockSource } from './mockSource'
import type { DataSource } from './source'

const source: DataSource = DATA_SOURCE === 'api' ? ApiSource : MockSource

export const getSessions = () => source.getSessions()
export const getTimeline = (sessionId: string) => source.getTimeline(sessionId)
/** All sessions that started on a local day, oldest first, with their timelines. */
export const getDay = (date: DayKey) => getDayFrom(source, date)
export const dataSourceName = DATA_SOURCE

export { labelFor, type Timeline } from './join'
export { addDays, dayEnd, dayKey, dayStart, isDayKey, todayKey, type Day, type DayKey } from './day'
