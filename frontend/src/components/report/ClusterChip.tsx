import { useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ContextLabel, MoodSwitch } from '../../types/contracts'
import { capitalize, formatClock } from '../../lib/format'
import { toneVar } from '../../lib/mood'
import PlatformIcon from '../PlatformIcon'
import TruncatedText from '../TruncatedText'

const POPOVER_W = 340

/** Fixed width so the lane layout can place the chip before it renders. */
export const clusterChipWidth = (n: number) => 20 + 12 + 8 + (Math.min(n, 5) * 5 + 3) + 8 + 74

interface Props {
  members: MoodSwitch[]
  /** Follows single chips of the same session: label reads "+N moments". */
  plus?: boolean
  labelOf: (switchId: string) => ContextLabel | undefined
  active: boolean
  highlightId: string | null
  style: CSSProperties
  /** Container width, to keep the popover on screen. */
  bounds: number
  onHighlight: (id: string | null) => void
  onSelect: (id: string) => void
}

/** Several close moments collapsed into one chip; expands into a list on hover or focus. */
export default function ClusterChip({ members, plus = false, labelOf, active, highlightId, style, bounds, onHighlight, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const left = Number(style.left ?? 0)
  const popShift = Math.min(0, bounds - POPOVER_W - left)
  const tones = members.map((sw) => toneVar(labelOf(sw.id)?.tone))

  return (
    <div
      className="absolute z-10"
      style={style}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        setOpen(false)
        onHighlight(null)
      }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${members.length} moments`}
        onClick={() => setOpen((o) => !o)}
        style={{ width: clusterChipWidth(members.length) }}
        className={`flex h-7 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
          active || open ? 'border-hairline-strong bg-elevated' : 'border-hairline bg-surface-2 hover:bg-elevated'
        }`}
      >
        <PlatformIcon platform={members[0].platform} size={12} />
        <span className="flex items-center">
          {tones.slice(0, 5).map((c, i) => (
            <span key={i} className="-ml-[1px] h-1.5 w-1.5 rounded-full ring-1 ring-surface-2 first:ml-0" style={{ background: c }} />
          ))}
        </span>
        <span className="text-ink">
          {plus ? '+' : ''}
          {members.length} moments
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-full pt-1.5"
            style={{ left: popShift, width: POPOVER_W }}
          >
            <ul className="rounded-[var(--radius-lg)] border border-hairline-strong bg-elevated p-1.5 shadow-[var(--shadow-pop)]">
              {members.map((sw) => {
                const label = labelOf(sw.id)
                return (
                  <li key={sw.id}>
                    <button
                      type="button"
                      onPointerEnter={() => onHighlight(sw.id)}
                      onFocus={() => onHighlight(sw.id)}
                      onClick={() => onSelect(sw.id)}
                      className={`grid w-full grid-cols-[64px_8px_1fr] items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[12px] transition-colors duration-100 hover:bg-surface-2 focus:bg-surface-2 active:bg-hairline ${
                        highlightId === sw.id ? 'bg-surface-2' : ''
                      }`}
                    >
                      <span className="font-mono text-[11px] text-muted">{formatClock(sw.ts, true).replace(/\s?[AP]M$/i, '')}</span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneVar(label?.tone) }} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-ink-2">
                            {sw.from} <span className="text-faint">→</span> {sw.to}
                          </span>
                          <span className={label ? 'text-ink' : 'text-muted'}>{label ? capitalize(label.category) : 'Pending'}</span>
                        </span>
                        {label && <TruncatedText text={label.topic} className="mt-0.5 text-[12px] text-muted" />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
