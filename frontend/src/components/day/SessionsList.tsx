import { memo } from 'react'
import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import type { RibbonSegment } from '../report/MoodRibbon'
import { formatClock, formatSpan, isLive, platformName, sessionSeconds } from '../../lib/format'
import PlatformIcon from '../PlatformIcon'
import MiniRibbon from '../MiniRibbon'
import LivePill from '../LivePill'

/** Compact rows, one per session; each opens the single-session report. */
export default memo(function SessionsList({ items, now, onOpen }: { items: RibbonSegment[]; now: number; onOpen: (id: string) => void }) {
  return (
    <ul className="-mx-4 flex flex-col gap-1">
      {items.map(({ timeline: t, samples }, i) => {
        const s = t.session
        return (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="group grid w-full grid-cols-[200px_200px_80px_1fr_24px] items-center gap-6 rounded-[var(--radius-md)] px-4 py-3 text-left transition-colors duration-150 hover:bg-surface active:bg-surface-2"
            >
              <span className="flex items-center gap-3 text-[14px] text-ink">
                <PlatformIcon platform={s.platform} size={16} tint />
                {platformName(s.platform)}
                {isLive(s) && <LivePill size="sm" />}
              </span>
              <span className="font-mono text-[13px] text-ink-2">
                {formatClock(s.start)} <span className="text-faint">→</span> {s.end === null ? 'now' : formatClock(s.end)}
              </span>
              <span className="text-right font-mono text-[13px] text-muted">{formatSpan(sessionSeconds(s, now))}</span>
              <span className="flex min-w-0 justify-end">
                {samples.length > 1 ? (
                  <MiniRibbon samples={samples} width={220} height={32} />
                ) : (
                  <span className="text-[12px] text-muted">No mood readings</span>
                )}
              </span>
              <ChevronRight size={16} className="text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-2" />
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
})
