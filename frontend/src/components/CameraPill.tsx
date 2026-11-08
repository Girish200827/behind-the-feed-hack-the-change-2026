import { Pause, Play } from 'lucide-react'
import { STATUS_LABEL, useCameraStatus } from '../hooks/useCameraStatus'
import { PulseDot } from './LivePill'

/** Sidebar: camera status (Watching / Paused / Off) with a small pause / resume button. */
export default function CameraPill() {
  const { status, toggle } = useCameraStatus()
  const paused = status === 'paused'
  return (
    <div className="flex items-center justify-between">
      <span className="label">Camera</span>
      <span className="flex items-center gap-1.5">
        <span className="flex items-center gap-2 rounded-full border border-hairline px-2.5 py-1 font-mono text-[11px] text-ink-2">
          {status === 'watching' ? <PulseDot /> : <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-ink-2' : 'bg-faint'}`} />}
          {status ? STATUS_LABEL[status] : '…'}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={!status}
          aria-label={paused ? 'Resume camera' : 'Pause camera'}
          title={paused ? 'Resume camera' : 'Pause camera'}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-hairline text-ink-2 transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-ink active:bg-elevated disabled:opacity-40"
        >
          {paused ? <Play size={11} /> : <Pause size={11} />}
        </button>
      </span>
    </div>
  )
}
