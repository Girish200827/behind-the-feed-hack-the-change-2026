import { memo, useMemo } from 'react'
import type { RibbonSegment } from '../report/MoodRibbon'
import { formatSpan } from '../../lib/format'
import { biggestShiftsAcross, drainedSeconds } from '../../lib/mood'
import CountUp from '../CountUp'
import { Cell, Percent, ShiftValue, Strip } from '../report/SummaryStrip'

/** Day totals: time, switches, share of time drained, and the biggest lift and drain (with platform). */
export default memo(function DaySummary({ items, totalSeconds }: { items: RibbonSegment[]; totalSeconds: number }) {
  const { switches, drained, lift, drain } = useMemo(() => {
  const switches = items.reduce((a, it) => a + it.timeline.switches.length, 0)
  const drained = items.reduce(
    (acc, it) => {
      const d = drainedSeconds(it.samples)
      return { below: acc.below + d.below, span: acc.span + d.span }
    },
    { below: 0, span: 0 }
  )
  const { lift, drain } = biggestShiftsAcross(items.map((it) => ({ timeline: it.timeline, samples: it.samples })))
  return { switches, drained, lift, drain }
  }, [items])

  return (
    <Strip cols={5}>
      <Cell tight label="Total time">
        <span className="font-mono">{formatSpan(totalSeconds)}</span>
      </Cell>
      <Cell tight label="Mood switches">
        <span className="font-mono">
          <CountUp value={switches} />
        </span>
      </Cell>
      <Cell tight label="Time feeling drained">
        <Percent value={drained.span > 0 ? drained.below / drained.span : null} />
      </Cell>
      <Cell tight label="Biggest lift">
        <ShiftValue shift={lift} color="var(--positive)" withPlatform />
      </Cell>
      <Cell tight label="Biggest drain">
        <ShiftValue shift={drain} color="var(--negative)" withPlatform />
      </Cell>
    </Strip>
  )
})
