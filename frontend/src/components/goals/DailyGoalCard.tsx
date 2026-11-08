import { Check, MessageCircle, Moon, Timer, type LucideIcon } from 'lucide-react'
import type { DailyGoalView, GoalStatus, GoalType } from '../../data'
import ProgressRing from './ProgressRing'

const TYPE: Record<GoalType, { label: string; icon: LucideIcon }> = {
  connection: { label: 'Connection', icon: MessageCircle },
  limit: { label: 'Limit', icon: Timer },
  timing: { label: 'Timing', icon: Moon }
}

const STATUS: Record<GoalStatus, string> = {
  met: 'Done',
  'on-track': 'On track',
  pending: 'Not yet',
  missed: 'Missed'
}

interface Props {
  view: DailyGoalView
  /** Show the check-in for a past day too (Goals page). */
  isToday: boolean
  onCheckIn: (value: boolean) => void
  variant?: 'compact' | 'full'
}

/** Today's social well-being goal: what it is, why, progress ring, streak and the one-tap check-in. */
export default function DailyGoalCard({ view, isToday, onCheckIn, variant = 'compact' }: Props) {
  const { goal, progress, streak, checkedIn } = view
  const { label, icon: Icon } = TYPE[goal.type]
  const full = variant === 'full'
  return (
    <section
      aria-label="Daily goal"
      className={`flex items-center gap-6 rounded-[var(--radius-lg)] border border-hairline bg-surface ${full ? 'px-8 py-7' : 'px-5 py-3'}`}
    >
      <ProgressRing progress={progress.progress} status={progress.status} size={full ? 72 : 44}>
        {progress.status === 'met' ? <Check size={full ? 22 : 16} /> : <Icon size={full ? 20 : 15} strokeWidth={1.75} />}
      </ProgressRing>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="label">{isToday ? "Today's goal" : 'Goal that day'}</span>
          <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {label}
          </span>
          <span className="font-mono text-[11px] text-muted">· {STATUS[progress.status]}</span>
        </div>
        <h2 className={`${full ? 'mt-2' : 'mt-1'} font-medium tracking-[-0.01em] text-ink ${full ? 'text-[22px]' : 'text-[16px]'}`}>{goal.title}</h2>
        <p className="mt-0.5 truncate text-[13px] text-muted" title={goal.why}>
          {goal.why}
        </p>
        {full && <p className="mt-3 font-mono text-[12px] text-ink-2">{progress.detail}</p>}
      </div>

      <div className={`flex shrink-0 items-end ${full ? 'flex-col gap-3' : 'flex-row-reverse items-center gap-5'}`}>
        <span className="font-mono text-[12px] text-ink-2" aria-label={`${streak}-day streak`}>
          <span className="text-[20px] font-medium text-ink">{streak}</span>
          <span className="ml-0.5 text-muted">-day streak</span>
        </span>
        {goal.needsCheckIn && isToday && (
          <button
            type="button"
            onClick={() => onCheckIn(!checkedIn)}
            aria-pressed={checkedIn}
            className={`no-drag flex h-9 items-center gap-2 rounded-[var(--radius-md)] border px-3 text-[13px] transition-colors duration-150 active:scale-[0.98] ${
              checkedIn
                ? 'border-transparent bg-positive/15 text-positive-ink hover:bg-positive/20'
                : 'border-hairline-strong text-ink hover:bg-surface-2 active:bg-elevated'
            }`}
          >
            {checkedIn ? <Check size={14} /> : <MessageCircle size={14} />}
            {checkedIn ? 'Checked in' : 'I reached out to someone today'}
          </button>
        )}
        {!goal.needsCheckIn && <span className="font-mono text-[11px] text-muted">{progress.detail}</span>}
      </div>
    </section>
  )
}
