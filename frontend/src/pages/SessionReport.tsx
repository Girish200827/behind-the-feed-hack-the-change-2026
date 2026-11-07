import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Waves } from 'lucide-react'
import { useSessions, useTimeline } from '../hooks/useReportData'
import { smoothSamples } from '../lib/smooth'
import ReportHeader from '../components/report/ReportHeader'
import SummaryStrip from '../components/report/SummaryStrip'
import MoodRibbon from '../components/report/MoodRibbon'
import MomentsList, { momentDomId } from '../components/report/MomentsList'
import Notice from '../components/Notice'
import EmptyState from '../components/EmptyState'

export default function SessionReport() {
  const [params, setParams] = useSearchParams()
  const sessions = useSessions()
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const list = sessions.status === 'ready' ? sessions.data : []
  const selectedId = params.get('session') ?? list[0]?.id
  const timeline = useTimeline(selectedId)
  const session = list.find((s) => s.id === selectedId)
  const data = timeline.status === 'ready' ? timeline.data : null

  // Chart-ready samples: low-confidence dropped, ~5 s rolling mean. Raw samples stay untouched.
  const chartSamples = useMemo(() => (data ? smoothSamples(data.samples) : []), [data])

  const scrollToMoment = (id: string) =>
    document.getElementById(momentDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (sessions.status === 'loading') return <Notice>Loading your sessions</Notice>
  if (sessions.status === 'error') return <Notice>Sessions could not be loaded. {sessions.message}</Notice>
  if (!list.length)
    return (
      <section className="flex flex-col gap-10">
        <h1 className="text-[40px] font-semibold leading-none tracking-[-0.03em]">Session Report</h1>
        <EmptyState
          icon={Waves}
          title="No scroll sessions yet"
          text="Open Instagram, TikTok, YouTube, X or Facebook and scroll as usual. Your first session will appear here when it starts."
        />
      </section>
    )

  return (
    <section className="flex flex-col gap-10">
      <ReportHeader session={session} sessions={list} onPick={(id) => setParams({ session: id })} />

      {timeline.status === 'error' && <Notice>This session could not be loaded. {timeline.message}</Notice>}
      {timeline.status === 'ready' && !data && <Notice>This session could not be found.</Notice>}
      {timeline.status === 'loading' && <div className="h-[560px]" />}
      {data && (
        <>
          <SummaryStrip timeline={data} samples={chartSamples} />

          <div>
            <h2 className="label mb-4">Mood over time</h2>
            <MoodRibbon
              timeline={data}
              samples={chartSamples}
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
