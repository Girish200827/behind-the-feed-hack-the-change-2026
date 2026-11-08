import { getDay, todayKey, type Day, type DayKey, type Timeline } from '../data'
import { POLL_LIVE_MS, POLL_SESSIONS_MS } from '../data/constants'
import { usePolled, type Load } from './usePolled'

/** A timeline's fingerprint: changes when a session ends or new samples, switches or labels arrive. */
export const timelineSig = (t: Timeline) => `${t.session.id}:${t.session.end}:${t.samples.length}:${t.switches.length}:${t.labels.length}`

/**
 * One local day's sessions and timelines. Today is kept fresh: every 2 s while a session is live,
 * otherwise every 5 s (new sessions appear on their own). Past days load once.
 */
export function useDay(date: DayKey): Load<Day> {
  return usePolled(date, () => getDay(date), {
    signature: (d) => d.timelines.map(timelineSig).join('|'),
    interval: (d) => (date !== todayKey() ? null : d.timelines.some((t) => t.session.end === null) ? POLL_LIVE_MS : POLL_SESSIONS_MS)
  })
}
