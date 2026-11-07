import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { dayKey, todayKey } from '../data'
import { useSessions, useTimeline } from '../hooks/useReportData'
import { smoothSamples } from '../lib/smooth'
import { formatDayTitle } from '../lib/format'
import ReportHeader from '../components/report/ReportHeader'
import SummaryStrip from '../components/report/SummaryStrip'
import MoodRibbon from '../components/report/MoodRibbon'
import MomentsList, { momentDomId } from '../components/report/MomentsList'
import Notice from '../components/Notice'

/** Detail view for one session, opened from the day view. */
export default function SessionReport() {
  const { id } = useParams()
  const navigate = useNavigate()
  const sessions = useSessions()
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const list = sessions.status === 'ready' ? sessions.data : []
  const timeline = useTimeline(id)
  const session = list.find((s) => s.id === id)
  const data = timeline.status === 'ready' ? timeline.data : null

  // Chart-ready samples: low-confidence dropped, ~5 s rolling mean. Raw samples stay untouched.
  const chartSamples = useMemo(() => (data ? smoothSamples(data.samples) : []), [data])

  const scrollToMoment = (switchId: string) =>
    document.getElementById(momentDomId(switchId))?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const today = todayKey()
  const day = session ? dayKey(session.start) : today
  const back = (
    <Link
      to={day === today ? '/today' : `/today?date=${day}`}
      className="no-drag -ml-2 inline-flex h-8 w-fit items-center gap-2 rounded-[var(--radius-md)] px-2 text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink active:bg-elevated"
    >
      <ArrowLeft size={14} />
      Back to {formatDayTitle(day, today)}
    </Link>
  )

  if (sessions.status === 'loading') return <Notice>Loading your sessions</Notice>
  if (sessions.status === 'error') return <Notice>Sessions could not be loaded. {sessions.message}</Notice>
  if (!session)
    return (
      <section className="flex flex-col gap-6">
        {back}
        <Notice>This session could not be found.</Notice>
      </section>
    )

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        {back}
        <ReportHeader session={session} sessions={list} onPick={(sid) => navigate(`/session/${encodeURIComponent(sid)}`, { replace: true })} />
      </div>

      {timeline.status === 'error' && <Notice>This session could not be loaded. {timeline.message}</Notice>}
      {timeline.status === 'ready' && !data && <Notice>This session could not be found.</Notice>}
      {timeline.status === 'loading' && <div className="h-[560px]" />}
      {data && (
        <>
          <SummaryStrip timeline={data} samples={chartSamples} />

          <div>
            <h2 className="label mb-4">Mood over time</h2>
            <MoodRibbon
              segments={[{ timeline: data, samples: chartSamples }]}
              mode="session"
              highlightId={highlightId}
              onHighlight={setHighlightId}
              onSelect={scrollToMoment}
            />
          </div>

          <div>
            <h2 className="label mb-2">Moments</h2>
            <MomentsList timeline={data} highlightId={highlightId} onHighlight={setHighlightId} />
          </div>

          <p className="text-[12px] text-muted">
            Mood signals, not a diagnosis. They come from facial expression and are meant as a gentle prompt to reflect.
          </p>
        </>
      )}
    </section>
  )
}
