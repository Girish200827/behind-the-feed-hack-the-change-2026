import { useSearchParams } from 'react-router-dom'
import { useSessions, useTimeline } from '../hooks/useReportData'
import SessionHeader from '../components/report/SessionHeader'
import SessionPicker from '../components/report/SessionPicker'
import MoodTimeline from '../components/report/MoodTimeline'
import SwitchList from '../components/report/SwitchList'
import Notice from '../components/Notice'

export default function SessionReport() {
  const [params, setParams] = useSearchParams()
  const sessions = useSessions()

  const list = sessions.status === 'ready' ? sessions.data : []
  const selectedId = params.get('session') ?? list[0]?.id
  const timeline = useTimeline(selectedId)

  if (sessions.status === 'loading') return <Notice>Loading your sessions…</Notice>
  if (sessions.status === 'error') return <Notice>Couldn't load sessions: {sessions.message}</Notice>
  if (!list.length)
    return <Notice>No scroll sessions yet. Open Instagram, TikTok, YouTube, X or Facebook and they'll appear here.</Notice>

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Session Report</h1>
        <SessionPicker sessions={list} value={selectedId} onChange={(id) => setParams({ session: id })} />
      </div>

      {timeline.status === 'loading' && <Notice>Loading session…</Notice>}
      {timeline.status === 'error' && <Notice>Couldn't load this session: {timeline.message}</Notice>}
      {timeline.status === 'ready' && !timeline.data && <Notice>This session couldn't be found.</Notice>}
      {timeline.status === 'ready' && timeline.data && (
        <>
          <SessionHeader timeline={timeline.data} />
          <MoodTimeline timeline={timeline.data} />
          <SwitchList timeline={timeline.data} />
          <p className="text-center text-xs text-muted">
            These are mood signals from facial expression, not a diagnosis. Use them as a gentle prompt to reflect.
          </p>
        </>
      )}
    </section>
  )
}
