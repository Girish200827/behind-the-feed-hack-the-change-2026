import { Pause, Play } from 'lucide-react'
import { STATUS_LABEL, useCameraStatus } from '../../hooks/useCameraStatus'
import { PulseDot } from '../LivePill'

const EXPLAIN = {
  watching: 'The camera is reading your expression while you scroll. Pause any time.',
  paused: 'Nothing is being recorded. Resume when you are ready.',
  off: 'No supported app is open, so the camera is off. It turns on only while you scroll.'
} as const

/** The big Pause / Resume control on the Privacy page. */
export default function PauseCard() {
  const { status, toggle } = useCameraStatus()
  const paused = status === 'paused'
  return (
    <section className="flex items-center justify-between gap-8 rounded-[var(--radius-lg)] border border-hairline bg-surface px-8 py-7">
      <div>
        <div className="label">Camera</div>
        <div className="mt-2 flex items-center gap-3">
          {status === 'watching' ? <PulseDot /> : <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-ink-2' : 'bg-faint'}`} />}
          <span className="text-[28px] font-semibold tracking-[-0.02em] text-ink">{status ? STATUS_LABEL[status] : '…'}</span>
        </div>
        <p className="mt-2 max-w-md text-[13px] text-muted">{status ? EXPLAIN[status] : ''}</p>
        <p className="mt-3 text-[11px] text-faint">Pause works inside this app for now; it will also stop the camera once connected to the backend.</p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={!status}
        aria-pressed={paused}
        className={`no-drag flex h-14 shrink-0 items-center gap-3 rounded-[var(--radius-lg)] px-7 text-[16px] font-medium transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-40 ${
          paused ? 'bg-accent text-bg hover:opacity-90' : 'border border-hairline-strong text-ink hover:bg-surface-2 active:bg-elevated'
        }`}
      >
        {paused ? <Play size={18} /> : <Pause size={18} />}
        {paused ? 'Resume camera' : 'Pause camera'}
      </button>
    </section>
  )
}
