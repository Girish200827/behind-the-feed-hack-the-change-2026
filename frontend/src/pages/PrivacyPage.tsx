import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { nudgesEnabled, resetConsent, setNudgesEnabled } from '../data'
import { useNudge } from '../components/nudge/NudgeProvider'
import { NUDGE_SUGGESTIONS } from '../lib/nudges'
import PauseCard from '../components/privacy/PauseCard'
import PrivacyFacts from '../components/privacy/PrivacyFacts'
import { NOT_A_DIAGNOSIS } from '../content/privacy'

/** Privacy & controls (C2): camera pause, what is and isn't recorded, nudges, and a consent reset for demos. */
export default function PrivacyPage() {
  const [enabled, setEnabled] = useState(nudgesEnabled)
  const { nudge } = useNudge()

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h1 className="text-[40px] font-semibold leading-none tracking-[-0.03em]">Privacy</h1>
        <p className="mt-4 max-w-2xl text-[14px] text-muted">What BehindFeed watches, what it keeps, and the gentle nudges it can give you.</p>
      </header>

      <PauseCard />

      <div>
        <h2 className="label mb-4">What is and isn't recorded</h2>
        <PrivacyFacts />
        <p className="mt-5 text-[13px] text-ink-2">{NOT_A_DIAGNOSIS} They come from facial expression and are meant as a gentle prompt to reflect.</p>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-hairline bg-surface px-8 py-7">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="label">Connect-instead nudges</div>
            <h2 className="mt-2 text-[20px] font-medium tracking-[-0.01em] text-ink">A gentle nudge when scrolling starts to drain you</h2>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
              If your mood signal stays below neutral for 5 minutes or more, BehindFeed suggests something with people or fresh air instead: {NUDGE_SUGGESTIONS.join(', ').toLowerCase()}. One nudge per stretch, shown in the app and as a notification.
            </p>
          </div>
          <Switch
            checked={enabled}
            label="Nudges"
            onChange={(v) => {
              setNudgesEnabled(v)
              setEnabled(v)
            }}
          />
        </div>
        <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
          <button
            type="button"
            disabled={!enabled}
            onClick={() => nudge(6)}
            className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-hairline-strong px-4 text-[13px] text-ink transition-colors hover:bg-surface-2 active:bg-elevated disabled:opacity-40"
          >
            <Sparkles size={14} /> Simulate a draining stretch
          </button>
          <span className="text-[12px] text-muted">{enabled ? 'For demos: shows the nudge as if you had felt drained for 6 minutes.' : 'Turn nudges on to try it.'}</span>
        </div>
      </section>

      <div className="flex items-center gap-3 text-[12px] text-muted">
        <button
          type="button"
          onClick={() => {
            resetConsent()
            location.reload()
          }}
          className="underline decoration-hairline-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
        >
          Reset consent (for demos)
        </button>
        <span className="text-faint">Shows the first-launch screen again.</span>
      </div>
    </section>
  )
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 ${checked ? 'border-transparent bg-accent' : 'border-hairline-strong bg-surface-2'}`}
    >
      <span className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-ink transition-[left] duration-150 ${checked ? 'left-[22px] bg-bg' : 'left-[3px]'}`} />
    </button>
  )
}
