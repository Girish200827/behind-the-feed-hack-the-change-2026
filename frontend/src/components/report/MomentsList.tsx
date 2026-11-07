import { motion } from 'motion/react'
import { labelFor, type Timeline } from '../../data'
import type { Emotion } from '../../types/contracts'
import { capitalize, formatClock } from '../../lib/format'
import { emotionTone, toneVar } from '../../lib/mood'
import PlatformIcon from '../PlatformIcon'
import TruncatedText from '../TruncatedText'

interface Props {
  timeline: Timeline
  highlightId: string | null
  onHighlight: (id: string | null) => void
}

export const momentDomId = (id: string) => `moment-${id}`

/** Minimal vertical timeline of mood switches. */
export default function MomentsList({ timeline, highlightId, onHighlight }: Props) {
  if (!timeline.switches.length)
    return <p className="text-[14px] text-muted">No mood switches this session. Your mood held steady.</p>

  return (
    <ol className="relative">
      {/* The rail */}
      <span className="absolute bottom-6 left-[131.5px] top-6 w-px bg-hairline" aria-hidden />
      {timeline.switches.map((sw, i) => {
        const label = labelFor(timeline, sw.id)
        const active = highlightId === sw.id
        return (
          <motion.li
            key={sw.id}
            id={momentDomId(sw.id)}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-24px' }}
            transition={{ duration: 0.28, delay: Math.min(i, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
            onPointerEnter={() => onHighlight(sw.id)}
            onPointerLeave={() => onHighlight(null)}
            className={`grid scroll-mt-24 grid-cols-[104px_24px_1fr] items-center gap-4 rounded-[var(--radius-md)] px-0 py-4 transition-colors duration-150 ${
              active ? 'bg-surface-2' : 'hover:bg-surface'
            }`}
          >
            <span className="whitespace-nowrap pl-4 font-mono text-[12px] tabular-nums text-muted">{formatClock(sw.ts, true)}</span>
            <span className="flex justify-center">
              <span
                className="relative h-2.5 w-2.5 rounded-full ring-4 ring-bg transition-transform duration-150"
                style={{ background: toneVar(label?.tone), transform: active ? 'scale(1.3)' : undefined }}
              />
            </span>
            <div className="flex min-w-0 items-center gap-6 pr-4">
              <div className="flex w-[232px] shrink-0 items-center gap-3">
                <PlatformIcon platform={sw.platform} size={14} />
                <EmotionPair from={sw.from} to={sw.to} />
              </div>
              <span
                className="w-[84px] shrink-0 text-[13px] font-medium"
                style={{ color: label ? toneInk(label.tone) : 'var(--muted)' }}
              >
                {label ? capitalize(label.category) : 'Pending'}
              </span>
              <TruncatedText
                text={label ? label.topic : 'Content label has not arrived yet'}
                className={`text-[14px] ${label ? 'text-ink-2' : 'italic text-muted'}`}
              />
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

const toneInk = (tone: string) =>
  tone === 'positive' ? 'var(--positive-ink)' : tone === 'negative' ? 'var(--negative-ink)' : 'var(--ink-2)'

function EmotionPair({ from, to }: { from: Emotion; to: Emotion }) {
  return (
    <span className="flex items-center gap-2 text-[14px]">
      <EmotionTag emotion={from} muted />
      <span className="text-faint">→</span>
      <EmotionTag emotion={to} />
    </span>
  )
}

function EmotionTag({ emotion, muted = false }: { emotion: Emotion; muted?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${muted ? 'text-muted' : 'font-medium text-ink'}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneVar(emotionTone(emotion)) }} />
      {emotion}
    </span>
  )
}
