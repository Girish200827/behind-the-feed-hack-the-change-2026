import type { WeekComparison, WeeklyGoalInfo } from '../../data'
import { capitalize, formatSpan } from '../../lib/format'

/**
 * This week's goal. The text comes from Allen's GET /goal (A5; Girish's G4 may reword it there). Without the
 * backend it's the same template computed on this device. The progress bar compares drained time with last week.
 */
export default function WeeklyGoal({ goal, week }: { goal: WeeklyGoalInfo; week: WeekComparison | null }) {
  const ratio = week && week.lastWeekDrainedSeconds > 0 ? week.thisWeekDrainedSeconds / week.lastWeekDrainedSeconds : null
  return (
    <section className="card px-8 py-7">
      <div className="flex items-center gap-3">
        <span className="label">This week</span>
        {goal.category && (
          <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {capitalize(goal.category)}
            {goal.triggerScore !== null && ` · ${Math.round(goal.triggerScore * 100)}% trigger`}
          </span>
        )}
      </div>
      <h2 className="mt-3 max-w-3xl text-[20px] font-medium leading-snug tracking-[-0.01em] text-ink">{goal.text}</h2>

      {ratio !== null && week && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between font-mono text-[12px]">
            <span className="text-muted">Drained time</span>
            <span className="text-ink-2">
              {formatSpan(week.thisWeekDrainedSeconds)} <span className="text-muted">this week vs</span> {formatSpan(week.lastWeekDrainedSeconds)}{' '}
              <span className="text-muted">last week</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(1, ratio) * 100}%`, background: ratio <= 1 ? 'var(--positive)' : 'var(--negative)' }}
            />
          </div>
        </div>
      )}
      <p className="mt-5 text-[11px] text-faint">
        {goal.source === 'api' ? 'From your insights: the content that most often brought your mood down.' : 'Computed on this device from the same pattern (demo data or service offline).'}
      </p>
    </section>
  )
}
