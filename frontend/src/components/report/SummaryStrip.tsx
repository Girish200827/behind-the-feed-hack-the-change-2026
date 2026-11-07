import type { ReactNode } from 'react'
import type { Timeline } from '../../data'
import type { EmotionSample } from '../../types/contracts'
import { capitalize } from '../../lib/format'
import { biggestShifts, drainedShare } from '../../lib/mood'
import CountUp from '../CountUp'

/** One quiet row of headline numbers, separated by hairlines. Uses the same chart-ready samples as the ribbon. */
export default function SummaryStrip({ timeline, samples }: { timeline: Timeline; samples: EmotionSample[] }) {
  const drained = samples.length ? drainedShare(samples) : null
  const { lift, drain } = biggestShifts(timeline, samples)
  return (
    <dl className="grid grid-cols-4 divide-x divide-hairline border-y border-hairline">
      <Cell label="Mood switches">
        <span className="font-mono">
          <CountUp value={timeline.switches.length} />
        </span>
      </Cell>
      <Cell label="Time feeling drained">
        {drained === null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="font-mono">
            <CountUp value={drained * 100} />
            <span className="ml-0.5 text-[0.55em] text-muted">%</span>
          </span>
        )}
      </Cell>
      <Cell label="Biggest lift">
        <Category name={lift} color="var(--positive)" />
      </Cell>
      <Cell label="Biggest drain">
        <Category name={drain} color="var(--negative)" />
      </Cell>
    </dl>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-6 py-6 first:pl-0">
      <dt className="label">{label}</dt>
      <dd className="text-[34px] font-medium leading-none tracking-[-0.02em] text-ink">{children}</dd>
    </div>
  )
}

function Category({ name, color }: { name: string | undefined; color: string }) {
  if (!name) return <span className="text-muted">—</span>
  return (
    <span className="flex items-center gap-3">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      {capitalize(name)}
    </span>
  )
}
