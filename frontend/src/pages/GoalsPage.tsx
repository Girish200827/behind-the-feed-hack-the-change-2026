import { todayKey } from '../data'
import { useDailyGoal } from '../hooks/useDailyGoal'
import { useWeek } from '../hooks/useWeek'
import DailyGoalCard from '../components/goals/DailyGoalCard'
import WeeklyGoal from '../components/goals/WeeklyGoal'
import Notice from '../components/Notice'

/** Goals: today's social well-being goal (frontend-only), then the weekly goal. */
export default function GoalsPage() {
  const today = todayKey()
  const { state, toggleCheckIn } = useDailyGoal(today)
  const week = useWeek(today)

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h1 className="text-[40px] font-semibold leading-none tracking-[-0.03em]">Goals</h1>
        <p className="mt-4 text-[14px] text-muted">Small daily steps toward scrolling that leaves you feeling better, and more time with people.</p>
      </header>

      <div>
        <h2 className="label mb-4">Today</h2>
        {state.status === 'ready' ? (
          <DailyGoalCard view={state.data} isToday onCheckIn={toggleCheckIn} variant="full" />
        ) : state.status === 'error' ? (
          <Notice>Today's goal could not be loaded. {state.message}</Notice>
        ) : (
          <div className="h-[140px]" />
        )}
      </div>

      <div>
        <h2 className="label mb-4">Weekly goal</h2>
        {week ? <WeeklyGoal week={week} /> : <div className="h-[180px]" />}
      </div>
    </section>
  )
}
