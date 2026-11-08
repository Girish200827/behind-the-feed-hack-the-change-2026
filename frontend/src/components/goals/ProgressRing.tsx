import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import type { GoalStatus } from '../../data'

const COLOR: Record<GoalStatus, string> = {
  met: 'var(--positive)',
  'on-track': 'var(--accent)',
  pending: 'var(--faint)',
  missed: 'var(--negative)'
}

/** Thin circular progress ring with an icon in the middle. */
export default function ProgressRing({ progress, status, size = 56, children }: { progress: number; status: GoalStatus; size?: number; children?: ReactNode }) {
  const stroke = 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, progress))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline-strong)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLOR[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ color: COLOR[status] }}>
        {children}
      </span>
    </span>
  )
}
