import { motion } from 'motion/react'
import type { Trigger } from '../../data'
import { capitalize } from '../../lib/format'

/**
 * Horizontal bars: for each content category, the share of mood switches that turned negative.
 * The top trigger is highlighted in coral (draining); the rest stay neutral so colour only marks the finding.
 */
export default function TopTriggers({ triggers }: { triggers: Trigger[] }) {
  const topIndex = triggers.findIndex((t) => t.negative > 0)
  return (
    <ul className="flex flex-col gap-1" aria-label="Top triggers">
      {triggers.map((t, i) => {
        const top = i === topIndex
        const pct = Math.round(t.triggerScore * 100)
        return (
          <li key={t.category} className="grid grid-cols-[120px_1fr_112px] items-center gap-5 py-2">
            <span className={`flex items-center gap-2 text-[14px] ${top ? 'font-medium text-ink' : 'text-ink-2'}`}>
              {capitalize(t.category)}
            </span>
            <span className="relative h-2 overflow-hidden rounded-full bg-surface-2">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: top ? 'var(--negative)' : 'color-mix(in oklab, var(--neutral) 70%, transparent)' }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, delay: Math.min(i, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
            <span className="flex items-baseline justify-end gap-2 font-mono">
              <span className={`text-[14px] ${top ? 'text-negative-ink' : 'text-ink'}`}>{pct}%</span>
              <span className="text-[11px] text-muted">
                {t.negative}/{t.switches}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
