import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { giveConsent, hasConsented } from '../data'
import { NOT_A_DIAGNOSIS } from '../content/privacy'
import PrivacyFacts from './privacy/PrivacyFacts'
import Wordmark from './Wordmark'

/** First launch: explain what is and isn't recorded, and ask for a required acknowledgement before anything else. */
export default function ConsentGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(hasConsented)
  const [checked, setChecked] = useState(false)
  if (ok) return <>{children}</>

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="drag h-[var(--titlebar-h)] shrink-0" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex max-w-[640px] flex-col gap-8 px-8 pb-16 pt-6"
        >
          <Wordmark />
          <header>
            <h1 className="text-[36px] font-semibold leading-tight tracking-[-0.03em]">Before you start</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              BehindFeed notices how scrolling makes you feel, so you can choose what lifts you. Here is exactly what it records. You can pause the camera any time.
            </p>
          </header>

          <PrivacyFacts compact />

          <p className="text-[13px] text-ink-2">{NOT_A_DIAGNOSIS} They are a gentle prompt to reflect.</p>

          <form
            className="flex flex-col gap-5 border-t border-hairline pt-6"
            onSubmit={(e) => {
              e.preventDefault()
              if (!checked) return
              giveConsent()
              setOk(true)
            }}
          >
            <label className="flex cursor-pointer items-start gap-3 text-[14px] text-ink">
              <input type="checkbox" required checked={checked} onChange={(e) => setChecked(e.target.checked)} className="peer sr-only" />
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-[1.5px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                  checked ? 'border-accent bg-accent text-bg' : 'border-hairline-strong bg-surface-2'
                }`}
              >
                {checked && <Check size={13} strokeWidth={2.5} />}
              </span>
              I understand what is and isn't recorded
            </label>
            <button
              type="submit"
              disabled={!checked}
              className="btn btn-primary h-11 w-fit px-6 text-[14px] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  )
}
