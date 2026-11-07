// Local-day helpers and getDay(): a day's sessions with their timelines, built on getSessions()/getTimeline().
import type { Session } from '../types/contracts'
import type { Timeline } from './join'
import type { DataSource } from './source'

/** 'YYYY-MM-DD' in the user's local time zone. */
export type DayKey = string

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(ts: number): DayKey {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const todayKey = (): DayKey => dayKey(Date.now() / 1000)

const toDate = (key: DayKey) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Unix seconds of local midnight at the start of the day. */
export const dayStart = (key: DayKey) => toDate(key).getTime() / 1000

/** Unix seconds of the next local midnight (handles 23 h / 25 h DST days). */
export const dayEnd = (key: DayKey) => dayStart(addDays(key, 1))

export function addDays(key: DayKey, n: number): DayKey {
  const d = toDate(key)
  d.setDate(d.getDate() + n)
  return dayKey(d.getTime() / 1000)
}

export const isDayKey = (s: string | null): s is DayKey => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export interface Day {
  date: DayKey
  /** The day's sessions (grouped by the local day they started), oldest first, with timelines. */
  timelines: Timeline[]
}

export async function getDayFrom(source: DataSource, date: DayKey): Promise<Day> {
  const sessions: Session[] = (await source.getSessions()).filter((s) => dayKey(s.start) === date)
  sessions.sort((a, b) => a.start - b.start)
  const timelines = await Promise.all(sessions.map((s) => source.getTimeline(s.id)))
  return { date, timelines: timelines.filter((t): t is Timeline => t !== null) }
}
