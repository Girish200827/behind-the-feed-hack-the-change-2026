import { labelFor, type Timeline } from '../../data'
import { formatClock } from '../../lib/format'
import CategoryChip from './CategoryChip'

export default function SwitchList({ timeline }: { timeline: Timeline }) {
  if (!timeline.switches.length)
    return <p className="text-sm text-muted">No mood switches in this session — your mood held steady.</p>

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <h2 className="border-b border-line px-6 py-4 text-base font-semibold">Mood switches</h2>
      <ul className="divide-y divide-line">
        {timeline.switches.map((sw) => {
          const label = labelFor(timeline, sw.id)
          return (
            <li key={sw.id} className="grid grid-cols-[6rem_11rem_7rem_1fr] items-center gap-4 px-6 py-3 text-sm">
              <span className="tabular-nums text-muted">{formatClock(sw.ts, true)}</span>
              <span>
                {sw.from} <span className="text-muted">→</span> <span className="font-medium">{sw.to}</span>
              </span>
              <CategoryChip label={label} />
              <span className={label ? '' : 'text-muted italic'}>
                {label ? label.topic : 'Still working out what was on screen'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
