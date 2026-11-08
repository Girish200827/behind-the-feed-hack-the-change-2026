import type { WeekComparison } from '../../data'
import { capitalize, formatSpan, platformName } from '../../lib/format'

/**
 * The weekly goal. It will come from Allen's insights (A5) with Giresh's wording (G4); until those are connected
 * it's computed on this device from the same pattern, with template wording.
 */
export default function WeeklyGoal({ week }: { week: WeekComparison }) {
  const drain = week.topDrain
  const title = drain
    ? `Swap one ${drain.p ? platformName(drain.p) : ''} session a day for something that lifts you`.replace('  ', ' ')
    : 'Notice which content lifts you, and choose more of it'
  const ratio = week.lastWeekDrainedSeconds > 0 ? week.thisWeekDrainedSeconds / week.lastWeekDrainedSeconds : null
  return (
    <section className="rounded-[var(--radius-lg)] border border-hairline bg-surface px-8 py-7">
      <div className="label">This week</div>
      <h2 className="mt-2 text-[22px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
      <p className="mt-1 text-[13px] text-muted">
        {drain
          ? `Pattern: ${capitalize(drain.c)}${drain.p ? ` on ${platformName(drain.p)}` : ''} brought your mood down most often this week${
              week.topLift ? `, while ${week.topLift} lifted it.` : '.'
            }`
          : 'Not enough data yet to spot a pattern.'}
      </p>

      {ratio !== null && (
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
      <p className="mt-5 text-[11px] text-faint">Weekly goal computed on this device until the insights service (A5) is connected.</p>
    </section>
  )
}
