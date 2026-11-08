import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Sunrise, Waves } from 'lucide-react'
import { addDays, dayEnd, dayStart, isDayKey, todayKey, type DayKey } from '../data'
import { useDay } from '../hooks/useDay'
import { useNow } from '../hooks/useNow'
import { DAY_SMOOTH_WINDOW_S, smoothSamples } from '../lib/smooth'
import { formatDayTitle, isLive, sessionSeconds } from '../lib/format'
import DayHeader from '../components/day/DayHeader'
import DayStrip from '../components/day/DayStrip'
import DaySummary from '../components/day/DaySummary'
import PlatformBreakdown from '../components/day/PlatformBreakdown'
import SessionsList from '../components/day/SessionsList'
import MoodRibbon, { type RibbonSegment } from '../components/report/MoodRibbon'
import EmptyState from '../components/EmptyState'
import DailyGoalCard from '../components/goals/DailyGoalCard'
import { useDailyGoal } from '../hooks/useDailyGoal'
import Notice from '../components/Notice'

/** The main screen: one local day across all platforms. */
export default function TodayPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const today = todayKey()
  const param = params.get('date')
  const date: DayKey = isDayKey(param) && param <= today ? param : today
  const day = useDay(date)
  const goal = useDailyGoal(date)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const goTo = (d: DayKey) => setParams(d === today ? {} : { date: d })
  const step = (n: -1 | 1) => {
    const next = addDays(date, n)
    if (next <= today) goTo(next)
  }
  const open = useCallback((sessionId: string) => navigate(`/session/${encodeURIComponent(sessionId)}`), [navigate])

  // Left/right arrow keys move between days.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [role="listbox"]')) return
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Chart-ready samples per session: low-confidence dropped, ~18 s centred rolling mean. Raw data stays untouched.
  const items: RibbonSegment[] = useMemo(
    () => (day.status === 'ready' ? day.data.timelines.map((t) => ({ timeline: t, samples: smoothSamples(t.samples, DAY_SMOOTH_WINDOW_S) })) : []),
    [day]
  )
  const live = items.some((it) => isLive(it.timeline.session))
  const now = useNow(live)
  const totalSeconds = items.reduce((a, it) => a + sessionSeconds(it.timeline.session, now), 0)

  return (
    <section className="flex flex-col gap-7">
      <DayHeader date={date} today={today} totalSeconds={totalSeconds} onStep={step} onToday={() => goTo(today)} />

      {goal.state.status === 'ready' && (
        <DailyGoalCard view={goal.state.data} isToday={date === today} onCheckIn={goal.toggleCheckIn} />
      )}

      {day.status === 'loading' && <div className="h-[640px]" />}
      {day.status === 'error' && <Notice>This day could not be loaded. {day.message}</Notice>}
      {day.status === 'ready' && items.length === 0 && (
        <EmptyState
          icon={date === today ? Sunrise : Waves}
          title={date === today ? 'No scrolling yet today' : `No scrolling on ${formatDayTitle(date, today)}`}
          text={
            date === today
              ? 'Enjoy the quiet. When you open Instagram, TikTok, YouTube, X or Facebook, your sessions will show up here.'
              : 'Nothing was recorded on this day. Use the arrows to look at another day.'
          }
        />
      )}
      {day.status === 'ready' && items.length > 0 && (
        <>
          <DayStrip start={dayStart(date)} end={dayEnd(date)} items={items} now={now} onOpen={open} />
          <div>
            <h2 className="label mb-3">Mood across the day</h2>
            <MoodRibbon
              segments={items}
              mode="day"
              highlightId={highlightId}
              onHighlight={setHighlightId}
              onSelect={(_, sessionId) => open(sessionId)}
            />
          </div>

          <DaySummary items={items} totalSeconds={totalSeconds} />

          <div>
            <h2 className="label mb-2">Platforms</h2>
            <PlatformBreakdown items={items} now={now} />
          </div>

          <div>
            <h2 className="label mb-2">Sessions</h2>
            <SessionsList items={items} now={now} onOpen={open} />
          </div>

          <p className="text-[12px] text-muted">
            Mood signals, not a diagnosis. They come from facial expression and are meant as a gentle prompt to reflect.
          </p>
        </>
      )}
    </section>
  )
}
