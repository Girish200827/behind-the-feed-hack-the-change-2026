import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Eye, EyeOff, Pause, Play } from 'lucide-react'
import Sidebar, { navItemFor } from './Sidebar'
import { PulseDot } from './LivePill'
import { useBackendStatus, type BackendState } from '../hooks/useBackendStatus'
import { STATUS_LABEL, useCameraStatus } from '../hooks/useCameraStatus'

const EASE = [0.16, 1, 0.3, 1] as const

const DATA_LABEL: Record<BackendState, string> = {
  demo: 'Demo data',
  live: 'Live data',
  offline: 'Backend offline – showing demo data',
  connecting: 'Connecting…'
}

export default function Layout() {
  const { pathname } = useLocation()
  const page = navItemFor(pathname)
  const { status } = useCameraStatus()
  const watching = status === 'watching'
  return (
    <div className="flex h-full bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header: draggable; avatar = camera indicator (gradient while watching) + page title/subtitle. */}
        <header className="drag flex h-16 shrink-0 items-center gap-3 border-b border-hairline px-10 pt-2">
          <span
            title={status ? `Camera: ${STATUS_LABEL[status]}` : 'Camera'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              watching ? 'text-white' : 'border border-hairline bg-surface-2 text-muted'
            }`}
            style={watching ? { background: 'var(--accent-gradient)' } : undefined}
          >
            {watching ? <Eye size={16} /> : <EyeOff size={16} />}
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[0.9rem] font-semibold tracking-[-0.01em] text-ink">{page?.label ?? 'BehindFeed'}</span>
            <span className="truncate text-[0.78rem] text-muted">{page?.subtitle ?? ''}</span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-none">
          <motion.div
            key={pathname.split('/')[1]}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="mx-auto max-w-[1200px] px-10 pb-16 pt-8"
          >
            <Outlet />
          </motion.div>
        </main>
        <footer className="shrink-0 border-t border-hairline bg-bg px-10 py-3">
          <StatusBar />
        </footer>
      </div>
    </div>
  )
}

/** Pill-shaped status footer: camera + data source on the left, pause/resume and the live dot on the right. */
function StatusBar() {
  const backend = useBackendStatus()
  const { status, toggle } = useCameraStatus()
  const paused = status === 'paused'
  return (
    <div
      role="status"
      className="flex h-10 items-center justify-between gap-4 rounded-full border border-hairline bg-surface-2 pl-4 pr-1.5 text-[0.78rem] text-muted"
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        <span className="font-medium text-ink">Camera {status ? STATUS_LABEL[status].toLowerCase() : '…'}</span>
        <span aria-hidden>·</span>
        <span className="truncate">{DATA_LABEL[backend]}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {status === 'watching' || backend === 'live' ? (
          <PulseDot />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-faint" />
        )}
        <button
          type="button"
          onClick={toggle}
          disabled={!status}
          aria-label={paused ? 'Resume camera' : 'Pause camera'}
          title={paused ? 'Resume camera' : 'Pause camera'}
          className="no-drag btn h-7 rounded-full px-3 text-[0.75rem]"
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? 'Resume' : 'Pause'}
        </button>
      </span>
    </div>
  )
}
