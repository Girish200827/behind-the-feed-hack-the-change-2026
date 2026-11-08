import { dataSourceName, getInsights, getWeeklyGoal, type Insights, type WeeklyGoalInfo } from '../data'
import { usePolled, type Load } from './usePolled'

/** With live data the analytics refresh on their own while the page is open; demo data loads once. */
const LIVE_INSIGHTS_MS = 15000
const LIVE_GOAL_MS = 30000

/** Insights (C4) through the data layer: A5 when reachable, otherwise computed on this device. */
export function useInsights(): Load<Insights> {
  return usePolled('insights', getInsights, {
    signature: (d) => JSON.stringify(d),
    interval: () => (dataSourceName === 'api' ? LIVE_INSIGHTS_MS : null)
  })
}

/** This week's goal: GET /goal when reachable, otherwise the same template computed here. */
export function useWeeklyGoal(): WeeklyGoalInfo | null {
  const state = usePolled('weekly-goal', getWeeklyGoal, {
    signature: (g) => JSON.stringify(g),
    interval: () => (dataSourceName === 'api' ? LIVE_GOAL_MS : null)
  })
  return state.status === 'ready' ? state.data : null
}
