import { useEffect, useState } from 'react'
import { getDay, type Day, type DayKey } from '../data'

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/** Loads one local day's sessions and timelines through the data layer. */
export function useDay(date: DayKey): Load<Day> {
  const [state, setState] = useState<Load<Day>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    getDay(date)
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e: Error) => alive && setState({ status: 'error', message: e.message }))
    return () => {
      alive = false
    }
  }, [date])
  return state
}
