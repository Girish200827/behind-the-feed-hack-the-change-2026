import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSessions, useTimeline } from '../hooks/useReportData'
import ReportHeader from '../components/report/ReportHeader'
import SummaryStrip from '../components/report/SummaryStrip'
import MoodRibbon from '../components/report/MoodRibbon'
import MomentsList, { momentDomId } from '../components/report/MomentsList'
import Notice from '../components/Notice'

export default function SessionReport() {
  const [params, setParams] = useSearchParams()
  const sessions = useSessions()
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const list = sessions.status === 'ready' ? sessions.data : []
  const selectedId = params.get('session') ?? list[0]?.id
  const timeline = useTimeline(selectedId)
  const session = list.find((s) => s.id === selectedId)

  const scrollToMoment = (id: string) =>
    document.getElementById(momentDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (sessions.status === 'loading') return <Notice>Loading your sessions</Notice>
  if (sessions.status === 'error') return <Notice>Sessions could not be loaded. {sessions.message}</Notice>
  if (!list.length)
    return <Notice>No scroll sessions yet. Open Instagram, TikTok, YouTube, X or Facebook and your first session will appear here.</Notice>

  return (
    <section className="flex flex-col gap-10">
      <ReportHeader session={session} sessions={list} onPick={(id) => setParams({ session: id })} />

      {timeline.status === 'error' && <Notice>This session could not be loaded. {timeline.message}</Notice>}
      {timeline.status === 'ready' && !timeline.data && <Notice>This session could not be found.</Notice>}
      {timeline.status === 'loading' && <div className="h-[560px]" />}
      {timeline.status === 'ready' && timeline.data && (
        <>
          <SummaryStrip timeline={timeline.data} />

          <div>
            <h2 className="label mb-4">Mood over time</h2>
            <MoodRibbon
              timeline={timeline.data}
              highlightId={highlightId}
              onHighlight={setHighlightId}
              onSelect={scrollToMoment}
            />
          </div>

          <div>
            <h2 className="label mb-2">Moments</h2>
            <MomentsList timeline={timeline.data} highlightId={highlightId} onHighlight={setHighlightId} />
          </div>

          <p className="text-[12px] text-muted">
            Mood signals, not a diagnosis. They come from facial expression and are meant as a gentle prompt to reflect.
          </p>
        </>
      )}
    </section>
  )
}
