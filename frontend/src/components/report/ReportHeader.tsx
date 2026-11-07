import type { Session } from '../../types/contracts'
import { useNow } from '../../hooks/useNow'
import { formatClock, formatDate, formatDuration, isLive, platformName, sessionSeconds } from '../../lib/format'
import PlatformIcon from '../PlatformIcon'
import LivePill from '../LivePill'
import SessionPicker from './SessionPicker'

interface Props {
  session: Session | undefined
  sessions: Session[]
  onPick: (id: string) => void
}

export default function ReportHeader({ session, sessions, onPick }: Props) {
  const live = session ? isLive(session) : false
  const now = useNow(live)
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
                <span className="text-ink-2">{formatDuration(sessionSeconds(session, now))}</span>
              </span>
              {live && <LivePill />}
            </h1>
            <p className="mt-4 font-mono text-[13px] text-muted">
              {formatDate(session.start)}
              <span className="mx-2 text-faint">/</span>
              {formatClock(session.start)} <span className="text-faint">→</span>{' '}
              {session.end === null ? 'now' : formatClock(session.end)}
            </p>
          </>
        )}
      </div>
      <SessionPicker sessions={sessions} value={session?.id} onChange={onPick} />
    </header>
  )
}
