import { useCallback, useEffect, useState } from 'react'
import { getDailyGoal, setCheckIn, type DailyGoalView, type DayKey } from '../data'

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/** Today's (or a past day's) goal, progress and streak, with a check-in toggle. */
export function useDailyGoal(date: DayKey) {
  const [state, setState] = useState<Load<DailyGoalView>>({ status: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    getDailyGoal(date)
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e: Error) => alive && setState({ status: 'error', message: e.message }))
    return () => {
      alive = false
    }
  }, [date, tick])

  const toggleCheckIn = useCallback(
    (value: boolean) => {
      setCheckIn(date, value)
      setTick((t) => t + 1)
    },
    [date]
  )

  return { state, toggleCheckIn }
}
