import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DayKey } from '../../data'
import { formatDayTitle, formatLongDate, formatSpan } from '../../lib/format'

interface Props {
  date: DayKey
  today: DayKey
  totalSeconds: number
  onStep: (days: -1 | 1) => void
  onToday: () => void
}

/** Large day title, the full date and total scroll time in mono, and previous/next day arrows. */
export default function DayHeader({ date, today, totalSeconds, onStep, onToday }: Props) {
  const isToday = date === today
  return (
    <header className="flex items-end justify-between gap-8">
      <div className="min-w-0">
        <h1 className="text-[40px] font-semibold leading-none tracking-[-0.03em]">{formatDayTitle(date, today)}</h1>
        <p className="mt-4 font-mono text-[13px] text-muted">
          {formatLongDate(date)}
          <span className="mx-2 text-faint">/</span>
          <span className="text-ink-2">{formatSpan(totalSeconds)}</span> scrolling
        </p>
      </div>
      <div className="no-drag flex items-center gap-2">
        {!isToday && (
          <button
            type="button"
            onClick={onToday}
            className="h-9 rounded-[var(--radius-md)] border border-hairline px-3 text-[13px] text-ink-2 transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-2 active:bg-elevated"
          >
            Today
          </button>
        )}
        <StepButton label="Previous day" onClick={() => onStep(-1)}>
          <ChevronLeft size={16} />
        </StepButton>
        <StepButton label="Next day" onClick={() => onStep(1)} disabled={isToday}>
          <ChevronRight size={16} />
        </StepButton>
      </div>
    </header>
  )
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-hairline text-ink-2 transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-2 active:bg-elevated disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}
