import type { ReactNode } from 'react'
import type { Timeline } from '../../data'
import type { EmotionSample } from '../../types/contracts'
import { capitalize, platformName } from '../../lib/format'
import { biggestShifts, drainedShare, type Shift } from '../../lib/mood'
import CountUp from '../CountUp'
import PlatformIcon from '../PlatformIcon'

/** One quiet row of headline numbers for a session, separated by hairlines. Uses the ribbon's chart-ready samples. */
export default function SummaryStrip({ timeline, samples }: { timeline: Timeline; samples: EmotionSample[] }) {
  const drained = samples.length ? drainedShare(samples) : null
  const { lift, drain } = biggestShifts(timeline, samples)
  return (
    <Strip>
      <Cell label="Mood switches">
        <span className="font-mono">
          <CountUp value={timeline.switches.length} />
        </span>
      </Cell>
      <Cell label="Time feeling drained">
        <Percent value={drained} />
      </Cell>
      <Cell label="Biggest lift">
        <ShiftValue shift={lift} color="var(--positive)" />
      </Cell>
      <Cell label="Biggest drain">
        <ShiftValue shift={drain} color="var(--negative)" />
      </Cell>
    </Strip>
  )
}

export function Strip({ children, cols = 4 }: { children: ReactNode; cols?: 4 | 5 }) {
  return (
    // Five columns (day view): short numbers get less room, "Comedy · on [icon]" gets more.
    <dl
      className={`grid divide-x divide-hairline border-y border-hairline ${
        cols === 5 ? 'grid-cols-[0.8fr_0.8fr_1.1fr_1.4fr_1.4fr]' : 'grid-cols-4'
      }`}
    >
      {children}
    </dl>
  )
}

export function Cell({ label, children, tight = false }: { label: string; children: ReactNode; tight?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 py-6 first:pl-0 ${tight ? 'px-5' : 'px-6'}`}>
      <dt className="label truncate">{label}</dt>
      <dd className={`font-medium leading-none tracking-[-0.02em] text-ink ${tight ? 'text-[28px]' : 'text-[34px]'}`}>{children}</dd>
    </div>
  )
}

export function Percent({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>
  return (
    <span className="font-mono">
      <CountUp value={value * 100} />
      <span className="ml-0.5 text-[0.55em] text-muted">%</span>
    </span>
  )
}

/** Category of a lift/drain; with `withPlatform`, "Comedy · on [icon]" (the platform's mark only, no name). */
export function ShiftValue({ shift, color, withPlatform = false }: { shift: Shift | undefined; color: string; withPlatform?: boolean }) {
  if (!shift) return <span className="text-muted">—</span>
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      <span className="truncate">{capitalize(shift.category)}</span>
      {withPlatform && (
        <span
          className="flex shrink-0 items-center gap-1.5 text-[13px] font-normal tracking-normal text-muted"
          aria-label={`on ${platformName(shift.platform)}`}
        >
          <span className="text-faint">·</span> on <PlatformIcon platform={shift.platform} size={15} />
        </span>
      )}
    </span>
  )
}
