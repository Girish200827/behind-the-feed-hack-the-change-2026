import type { ContextLabel } from '../../types/contracts'
import { capitalize } from '../../lib/format'

const TONE_CLASSES = {
  positive: 'bg-positive/15 text-positive',
  neutral: 'bg-neutral/15 text-muted',
  negative: 'bg-negative/15 text-negative'
} as const

/** Category chip colored by tone. Shows "Label pending" if the screen labeller hasn't sent one yet. */
export default function CategoryChip({ label }: { label: ContextLabel | undefined }) {
  if (!label)
    return (
      <span className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted">
        Label pending
      </span>
    )
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[label.tone]}`}>
      {capitalize(label.category)}
    </span>
  )
}
