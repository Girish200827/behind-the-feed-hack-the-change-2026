import type { Timeline } from '../../data'
import { formatClock, formatDate, formatDuration, platformName } from '../../lib/format'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-lg font-medium">{value}</div>
    </div>
  )
}

export default function SessionHeader({ timeline }: { timeline: Timeline }) {
  const { session, switches } = timeline
  return (
    <div className="grid grid-cols-2 gap-6 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-4">
      <Stat label="Platform" value={platformName(session.platform)} />
      <Stat label={formatDate(session.start)} value={`${formatClock(session.start)} – ${formatClock(session.end)}`} />
      <Stat label="Duration" value={formatDuration(session.end - session.start)} />
      <Stat label="Mood switches" value={String(switches.length)} />
    </div>
  )
}
