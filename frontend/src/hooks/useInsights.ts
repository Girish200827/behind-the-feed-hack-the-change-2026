import { useEffect, useState } from 'react'
import { getInsights, getWeeklyGoal, type Insights, type WeeklyGoalInfo } from '../data'
import type { Load } from './usePolled'

/** Insights (C4) through the data layer: A5 when reachable, otherwise computed on this device. */
export function useInsights(): Load<Insights> {
  const [state, setState] = useState<Load<Insights>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    getInsights()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e: Error) => alive && setState({ status: 'error', message: e.message }))
    return () => {
      alive = false
    }
  }, [])
  return state
}

/** This week's goal: GET /goal when reachable, otherwise the same template computed here. */
export function useWeeklyGoal(): WeeklyGoalInfo | null {
  const [goal, setGoal] = useState<WeeklyGoalInfo | null>(null)
  useEffect(() => {
    let alive = true
    getWeeklyGoal()
      .then((g) => alive && setGoal(g))
      .catch(() => alive && setGoal(null))
    return () => {
      alive = false
    }
  }, [])
  return goal
}
