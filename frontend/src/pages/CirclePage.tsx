import { useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, Check, Lock, Send } from 'lucide-react'
import {
  getCircleSettings,
  getSampleCircleFeed,
  getSentLog,
  saveCircleSettings,
  shareToCircle,
  todayKey,
  type CircleSettings
} from '../data'
import type { DiscordPayload, SendResult } from '../types/bridge'
import { useDailyGoal } from '../hooks/useDailyGoal'
import { useWeek } from '../hooks/useWeek'
import { buildChallengeInvite, buildProgressMessage, CHALLENGES, type ChallengeId, type GoalOutcome } from '../lib/circleMessage'
import MessagePreview from '../components/circle/MessagePreview'
import ConnectCard from '../components/circle/ConnectCard'

/** Scroll Circle: share small wins with friends through your own Discord server. */
export default function CirclePage() {
  const [settings, setSettings] = useState<CircleSettings>(getCircleSettings)
  const [sentVersion, setSentVersion] = useState(0)
  const today = todayKey()
  const { state } = useDailyGoal(today)
  const week = useWeek(today)
  const demo = !settings.webhookUrl
  const [challenge, setChallenge] = useState<ChallengeId>('scroll-less-week')

  const progress: DiscordPayload | null = useMemo(() => {
    if (state.status !== 'ready') return null
    const s = state.data.progress.status
    const outcome: GoalOutcome = s === 'met' ? 'met' : s === 'missed' ? 'missed' : 'in-progress'
    return buildProgressMessage({
      displayName: settings.displayName,
      goalTitle: state.data.goal.title,
      outcome,
      streak: state.data.streak,
      drainedChange: week?.drainedChange ?? null
    })
  }, [state, week, settings.displayName])
  const invite = buildChallengeInvite(settings.displayName, challenge)
  // Re-read the sent log after each successful send.
  const sent = useMemo(() => (sentVersion >= 0 ? getSentLog() : []), [sentVersion])

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h1 className="text-[40px] font-semibold leading-none tracking-[-0.03em]">Circle</h1>
        <p className="mt-4 max-w-2xl text-[14px] text-muted">
          Share small wins with a few friends through your own Discord server, and keep each other going. You choose what goes out, and you see it first.
        </p>
      </header>

      {demo && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-hairline-strong px-4 py-3 text-[13px] text-ink-2">
          <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Demo mode</span>
          No webhook yet, so the circle below shows sample messages. Add your Discord webhook to share for real.
        </div>
      )}

      <div className="grid grid-cols-[1.35fr_1fr] items-start gap-6">
        <div className="flex flex-col gap-6">
          <Card title="Share my progress">
            {progress ? (
              <>
                <div className="rounded-[var(--radius-md)] border border-hairline bg-bg px-4 py-4">
                  <MessagePreview payload={progress} />
                </div>
                <PrivacyNote />
                <SendButton payload={progress} demo={demo} label="Share my progress" onSent={() => setSentVersion((v) => v + 1)} />
              </>
            ) : (
              <div className="h-[140px]" />
            )}
          </Card>

          <Card title="Start a challenge">
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Challenge">
              {(Object.keys(CHALLENGES) as ChallengeId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={challenge === id}
                  onClick={() => setChallenge(id)}
                  className={`rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors duration-150 ${
                    challenge === id ? 'border-accent/60 bg-accent-soft' : 'border-hairline hover:border-hairline-strong hover:bg-surface-2'
                  }`}
                >
                  <div className="text-[14px] font-medium text-ink">{CHALLENGES[id].title}</div>
                  <div className="mt-1 text-[12px] leading-snug text-muted">{CHALLENGES[id].blurb}</div>
                </button>
              ))}
            </div>
            <div className="rounded-[var(--radius-md)] border border-hairline bg-bg px-4 py-4">
              <MessagePreview payload={invite} />
            </div>
            <SendButton payload={invite} demo={demo} label="Post invite" onSent={() => setSentVersion((v) => v + 1)} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Connect your circle">
            <ConnectCard
              settings={settings}
              onSave={(s) => {
                saveCircleSettings(s)
                setSettings(getCircleSettings())
              }}
            />
          </Card>

          <Card title={demo ? 'Your circle (sample)' : 'Shared from this device'}>
            {demo ? (
              <ul className="flex flex-col gap-5">
                {getSampleCircleFeed().map((m) => (
                  <li key={m.name}>
                    <MessagePreview payload={{ content: m.content }} author={m.name} meta={`${m.minutesAgo} min ago`} sample />
                  </li>
                ))}
              </ul>
            ) : sent.length ? (
              <ul className="flex flex-col gap-5">
                {sent.slice(0, 5).map((m) => (
                  <li key={m.at}>
                    <MessagePreview
                      payload={{ content: m.content, username: 'Scroll Mood' }}
                      meta={new Date(m.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">Nothing shared yet. Your circle will see your check-ins in Discord.</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-hairline bg-surface px-6 py-6">
      <h2 className="label">{title}</h2>
      {children}
    </section>
  )
}

function PrivacyNote() {
  return (
    <p className="flex gap-2 text-[12px] leading-relaxed text-muted">
      <Lock size={13} className="mt-0.5 shrink-0" />
      <span>
        <span className="text-ink-2">Only this message is shared.</span> Never your moment-by-moment emotions, what you watched, screenshots or any raw data.
      </span>
    </p>
  )
}

function SendButton({ payload, demo, label, onSent }: { payload: DiscordPayload; demo: boolean; label: string; onSent: () => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={demo || busy}
        onClick={async () => {
          setBusy(true)
          setResult(null)
          const r = await shareToCircle(payload)
          setBusy(false)
          setResult(r)
          if (r.ok) onSent()
        }}
        className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-4 text-[13px] font-medium text-bg transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send size={14} />
        {busy ? 'Sending…' : label}
      </button>
      {demo && <span className="text-[12px] text-muted">Add a webhook to send.</span>}
      {result?.ok && (
        <span role="status" className="flex items-center gap-1.5 text-[12px] text-positive-ink">
          <Check size={13} /> Shared with your circle
        </span>
      )}
      {result && !result.ok && (
        <span role="alert" className="flex items-center gap-1.5 text-[12px] text-negative-ink">
          <AlertCircle size={13} /> {result.message}
        </span>
      )}
    </div>
  )
}
