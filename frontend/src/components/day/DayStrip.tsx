import { useState, memo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { RibbonSegment } from '../report/MoodRibbon'
import { formatClock, platformName } from '../../lib/format'
import { avgValence, moodTone, toneVar } from '../../lib/mood'
import PlatformIcon from '../PlatformIcon'

interface Props {
  /** Local midnight at the start and end of the day (Unix seconds). */
  start: number
  end: number
  items: RibbonSegment[]
  now: number
  onOpen: (sessionId: string) => void
}

const TICKS = [
  { at: 0.25, label: '6 AM' },
  { at: 0.5, label: '12 PM' },
  { at: 0.75, label: '6 PM' }
]

/** A thin 24-hour bar with each session at its real time, tinted by its average mood. */
export default memo(function DayStrip({ start, end, items, now, onOpen }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const span = end - start
  const pct = (ts: number) => `${(Math.min(Math.max(ts, start), end) - start) / span * 100}%`
  const showNow = now >= start && now < end

  return (
    <div className="no-drag">
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-surface-2" />
        {TICKS.map((t) => (
          <span key={t.at} className="absolute top-1/2 h-[6px] w-px -translate-y-1/2 bg-hairline-strong" style={{ left: `${t.at * 100}%` }} />
        ))}

        {items.map(({ timeline: t, samples }) => {
          const s = t.session
          const sEnd = s.end ?? now
          const color = toneVar(moodTone(avgValence(samples)))
          const isHover = hover === s.id
          return (
            <button
              key={s.id}
              type="button"
              aria-label={`${platformName(s.platform)} ${formatClock(s.start)} to ${s.end === null ? 'now' : formatClock(s.end)}`}
              onPointerEnter={() => setHover(s.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(s.id)}
              onBlur={() => setHover(null)}
              onClick={() => onOpen(s.id)}
              className="absolute top-1/2 h-4 min-w-[4px] -translate-y-1/2 rounded-[4px] transition-[transform,box-shadow] duration-150 ease-out hover:scale-y-125 active:scale-y-110"
              style={{
                left: pct(s.start),
                width: `calc(${pct(sEnd)} - ${pct(s.start)})`,
                background: `color-mix(in oklab, ${color} 75%, transparent)`,
                boxShadow: isHover ? `0 0 0 2px var(--bg), 0 0 0 3px ${color}` : undefined
              }}
            >
              <AnimatePresence>
                {isHover && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2.5 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border border-hairline-strong bg-elevated px-2.5 py-1.5 shadow-[var(--shadow-pop)]"
                  >
                    <PlatformIcon platform={s.platform} size={13} tint />
                    <span className="font-mono text-[11px] text-ink-2">
                      {formatClock(s.start)} – {s.end === null ? 'now' : formatClock(s.end)}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )
        })}

        {showNow && (
          <span className="pointer-events-none absolute top-1/2 h-5 w-px -translate-y-1/2 bg-accent" style={{ left: pct(now) }}>
            <span className="absolute -left-[2px] -top-[3px] h-[5px] w-[5px] rounded-full bg-accent" />
          </span>
        )}
      </div>

      <div className="relative mt-1 h-4">
        {TICKS.map((t) => (
          <span
            key={t.at}
            className="absolute -translate-x-1/2 font-mono text-[10.5px] text-muted"
            style={{ left: `${t.at * 100}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
})
