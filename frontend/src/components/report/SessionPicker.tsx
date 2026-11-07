import type { Session } from '../../types/contracts'
import { formatClock, formatDate, formatDuration, platformName } from '../../lib/format'

interface Props {
  sessions: Session[]
  value: string | undefined
  onChange: (id: string) => void
}

export default function SessionPicker({ sessions, value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Session
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {platformName(s.platform)} · {formatDate(s.start)}, {formatClock(s.start)} · {formatDuration(s.end - s.start)}
          </option>
        ))}
      </select>
    </label>
  )
}
