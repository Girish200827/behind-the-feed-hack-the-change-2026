import type { Session } from '../../types/contracts'
import { formatClock, formatDate, formatDuration, platformName } from '../../lib/format'
import PlatformIcon from '../PlatformIcon'
import SessionPicker from './SessionPicker'

interface Props {
  session: Session | undefined
  sessions: Session[]
  onPick: (id: string) => void
}

export default function ReportHeader({ session, sessions, onPick }: Props) {
  return (
    <header className="flex items-start justify-between gap-8">
      <div className="min-w-0">
        {session && (
          <>
            <h1 className="flex items-center gap-4 text-[40px] font-semibold leading-none tracking-[-0.03em]">
              <PlatformIcon platform={session.platform} size={30} tint />
              <span>
                {platformName(session.platform)}
                <span className="mx-3 text-faint">·</span>
                <span className="text-ink-2">{formatDuration(session.end - session.start)}</span>
              </span>
            </h1>
            <p className="mt-4 font-mono text-[13px] text-muted">
              {formatDate(session.start)}
              <span className="mx-2 text-faint">/</span>
              {formatClock(session.start)} <span className="text-faint">→</span> {formatClock(session.end)}
            </p>
          </>
        )}
      </div>
      <SessionPicker sessions={sessions} value={session?.id} onChange={onPick} />
    </header>
  )
}
