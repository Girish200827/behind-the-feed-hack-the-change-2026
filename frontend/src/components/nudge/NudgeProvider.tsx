import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Sparkles, X } from 'lucide-react'
import {
  getDailyGoal,
  getSessions,
  getStatus,
  getTimeline,
  markStretchSeen,
  notifyNative,
  nudgesEnabled,
  setCheckIn,
  takeSuggestionIndex,
  todayKey,
  type DailyGoal
} from '../../data'
import { DAY_SMOOTH_WINDOW_S, smoothSamples } from '../../lib/smooth'
import { ongoingStretch, suggestionAt } from '../../lib/nudges'

interface Nudge {
  id: number
  minutes: number
  suggestion: string
  goal?: DailyGoal
}

const NudgeContext = createContext<{ nudge: (minutes: number) => Promise<void> }>({ nudge: async () => {} })
export const useNudge = () => useContext(NudgeContext)

/** How often the live session is checked for a draining stretch. */
const WATCH_EVERY_MS = 30_000

/** Shows connect-instead nudges (in-app toast + native notification) and watches the live session. */
export default function NudgeProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Nudge | null>(null)
  const [checked, setChecked] = useState(false)

  const nudge = useCallback(async (minutes: number) => {
    if (!nudgesEnabled()) return
    const suggestion = suggestionAt(takeSuggestionIndex())
    const goal = await getDailyGoal(todayKey())
      .then((g) => g.goal)
      .catch(() => undefined)
    setChecked(false)
    setCurrent({ id: Date.now(), minutes, suggestion, goal })
    const linked = goal?.type === 'connection' ? ` It's also today's goal.` : ''
    notifyNative('Time for a little break?', `You've felt drained for ${minutes} minutes. ${suggestion}?${linked}`)
  }, [])

  // Watch the live session (end = null) for a draining stretch of 5+ minutes; nudge once per stretch.
  useEffect(() => {
    let alive = true
    const check = async () => {
      // No nudges while nudges are off or the camera is paused.
      if (!nudgesEnabled() || (await getStatus()) === 'paused') return
      const live = (await getSessions()).find((s) => s.end === null)
      if (!live) return
      const t = await getTimeline(live.id)
      const stretch = t && ongoingStretch(smoothSamples(t.samples, DAY_SMOOTH_WINDOW_S))
      if (alive && stretch && markStretchSeen(`${live.id}@${Math.round(stretch.start)}`)) await nudge(Math.round(stretch.seconds / 60))
    }
    check().catch(() => undefined)
    const timer = setInterval(() => check().catch(() => undefined), WATCH_EVERY_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [nudge])

  return (
    <NudgeContext.Provider value={{ nudge }}>
      {children}
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="no-drag fixed bottom-6 right-6 z-50 w-[360px] rounded-[var(--radius-lg)] border border-hairline-strong bg-elevated p-5 shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Sparkles size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted">You've felt drained for {current.minutes} minutes.</p>
                <p className="mt-1 text-[16px] font-medium text-ink">{current.suggestion}?</p>
                {current.goal?.type === 'connection' && (
                  <p className="mt-2 text-[12px] text-ink-2">
                    That's also today's goal: <span className="text-ink">{current.goal.title}</span>
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  {current.goal?.type === 'connection' && (
                    <button
                      type="button"
                      disabled={checked}
                      onClick={() => {
                        setCheckIn(todayKey(), true)
                        setChecked(true)
                      }}
                      className="flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-hairline-strong px-3 text-[12px] text-ink transition-colors hover:bg-surface-2 active:bg-surface disabled:text-positive-ink"
                    >
                      <Check size={13} /> {checked ? 'Checked in' : 'Done, check me in'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrent(null)}
                    className="h-8 rounded-[var(--radius-md)] px-3 text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    Not now
                  </button>
                </div>
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => setCurrent(null)} className="text-faint transition-colors hover:text-ink">
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NudgeContext.Provider>
  )
}
