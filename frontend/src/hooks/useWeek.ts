import { useEffect, useState } from 'react'
import { getWeekComparison, type DayKey, type WeekComparison } from '../data'

/** This week vs last week (drained time, top drain/lift), through the data layer. */
export function useWeek(date: DayKey): WeekComparison | null {
  const [week, setWeek] = useState<WeekComparison | null>(null)
  useEffect(() => {
    let alive = true
    getWeekComparison(date)
      .then((w) => alive && setWeek(w))
      .catch(() => alive && setWeek(null))
    return () => {
      alive = false
    }
  }, [date])
  return week
}
