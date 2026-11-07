import { useMemo, memo } from 'react'
import { motion } from 'motion/react'
import type { EmotionSample, Platform } from '../../types/contracts'
import type { RibbonSegment } from '../report/MoodRibbon'
import { formatSpan, platformName, sessionSeconds } from '../../lib/format'
import { avgValence, moodTone, toneVar } from '../../lib/mood'
import PlatformIcon from '../PlatformIcon'
import MiniRibbon from '../MiniRibbon'

const TONE_WORD = { positive: 'Mostly lifting', neutral: 'Mixed', negative: 'Mostly draining' } as const

interface Row {
  platform: Platform
  seconds: number
  switches: number
  /** The platform's sessions back to back (gaps removed) for the sparkline. */
  series: EmotionSample[]
  avg: number | undefined
}

/** One minimal row per platform used that day, sorted by time spent. */
export default memo(function PlatformBreakdown({ items, now }: { items: RibbonSegment[]; now: number }) {
  const rows = useMemo(() => {
    const by = new Map<Platform, Row>()
    for (const { timeline: t, samples } of items) {
      const p = t.session.platform
      const row = by.get(p) ?? { platform: p, seconds: 0, switches: 0, series: [], avg: undefined }
      const offset = row.series.length ? row.series[row.series.length - 1].ts + 1 - (samples[0]?.ts ?? 0) : 0
      row.series = row.series.concat(samples.map((s) => ({ ...s, ts: s.ts + offset })))
      row.seconds += sessionSeconds(t.session, now)
      row.switches += t.switches.length
      by.set(p, row)
    }
    return [...by.values()].map((r) => ({ ...r, avg: avgValence(r.series) })).sort((a, b) => b.seconds - a.seconds)
  }, [items, now])

  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      {rows.map((r, i) => {
        const tone = moodTone(r.avg)
        return (
          <motion.li
            key={r.platform}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.25, delay: Math.min(i, 5) * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-[200px_96px_1fr_160px_112px] items-center gap-6 py-4"
          >
            <span className="flex items-center gap-3 text-[14px] text-ink">
              <PlatformIcon platform={r.platform} size={16} tint />
              {platformName(r.platform)}
            </span>
            <span className="text-right font-mono text-[14px] text-ink">{formatSpan(r.seconds)}</span>
            <span className="flex min-w-0 justify-center">
              <MiniRibbon samples={r.series} width={240} height={28} fill={false} />
            </span>
            <span className="flex items-center gap-2 text-[13px] text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: toneVar(tone), boxShadow: `0 0 10px ${toneVar(tone)}` }} />
              {TONE_WORD[tone]}
            </span>
            <span className="text-right font-mono text-[12px] text-muted">
              {r.switches} {r.switches === 1 ? 'switch' : 'switches'}
            </span>
          </motion.li>
        )
      })}
    </ul>
  )
})
