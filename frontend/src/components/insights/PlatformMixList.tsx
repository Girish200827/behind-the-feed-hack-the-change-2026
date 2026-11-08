import type { PlatformMix } from '../../data'
import { formatSpan, platformName } from '../../lib/format'
import { moodTone, toneVar } from '../../lib/mood'
import PlatformIcon from '../PlatformIcon'

const TONE_WORD = { positive: 'Mostly lifting', neutral: 'Mixed', negative: 'Mostly draining' } as const

/** Time and average mood per platform, sorted by time. */
export default function PlatformMixList({ mix }: { mix: PlatformMix[] }) {
  const max = Math.max(1, ...mix.map((m) => m.minutes))
  return (
    <ul className="divide-y divide-hairline border-y border-hairline" aria-label="Platform mix">
      {mix.map((m) => {
        const tone = moodTone(m.avgValence)
        return (
          <li key={m.platform} className="grid grid-cols-[180px_1fr_80px_150px_90px] items-center gap-5 py-3.5">
            <span className="flex items-center gap-3 text-[14px] text-ink">
              <PlatformIcon platform={m.platform} size={16} tint />
              {platformName(m.platform)}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-ink-2/50" style={{ width: `${(m.minutes / max) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-[14px] text-ink">{formatSpan(m.minutes * 60)}</span>
            <span className="flex items-center gap-2 text-[13px] text-ink-2">
              {m.avgValence === undefined ? (
                <span className="text-muted">No readings</span>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full" style={{ background: toneVar(tone), boxShadow: `0 0 10px ${toneVar(tone)}` }} />
                  {TONE_WORD[tone]}
                </>
              )}
            </span>
            <span className="text-right font-mono text-[12px] text-muted">
              {m.sessions} {m.sessions === 1 ? 'session' : 'sessions'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
