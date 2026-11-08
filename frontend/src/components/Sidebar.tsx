import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Activity, Lightbulb, ShieldCheck, Target, Users, type LucideIcon } from 'lucide-react'
import Wordmark from './Wordmark'
import CameraPill from './CameraPill'
import { FEATURES } from '../config/features'
import { useBackendStatus, type BackendState } from '../hooks/useBackendStatus'

const DATA_PILL: Record<BackendState, { value: string; dot: string }> = {
  demo: { value: 'Demo', dot: 'var(--accent)' },
  live: { value: 'Live', dot: 'var(--positive)' },
  offline: { value: 'Offline', dot: 'var(--negative)' },
  connecting: { value: '…', dot: 'var(--faint)' }
}

const ALL_NAV: { to: string; label: string; icon: LucideIcon; also?: string[] }[] = [
  { to: '/today', label: 'Today', icon: Activity, also: ['/session'] },
  { to: '/privacy', label: 'Privacy', icon: ShieldCheck },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/circle', label: 'Circle', icon: Users }
]
// Scroll Circle only shows when VITE_ENABLE_CIRCLE=true (src/config/features.ts).
const NAV = ALL_NAV.filter((item) => item.to !== '/circle' || FEATURES.circle)

export default function Sidebar() {
  const { pathname } = useLocation()
  const backend = useBackendStatus()
  const isActive = (item: (typeof NAV)[number]) =>
    [item.to, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(p + '/'))
  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-hairline">
      <div className="drag flex h-[var(--titlebar-h)] items-center px-5" />
      <div className="px-5 pb-8 pt-2">
        <Wordmark />
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const { to, label, icon: Icon } = item
          const active = isActive(item)
          return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className="group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] outline-none transition-colors duration-150 focus-visible:outline-1 focus-visible:outline-accent"
          >
              <>
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md border border-hairline bg-surface-2"
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  />
                )}
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={`relative transition-colors ${active ? 'text-accent' : 'text-muted group-hover:text-ink-2'}`}
                />
                <span
                  className={`relative transition-colors ${
                    active ? 'font-medium text-ink' : 'text-muted group-hover:text-ink-2 group-active:text-ink'
                  }`}
                >
                  {label}
                </span>
              </>
          </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-hairline px-5 py-5">
        <CameraPill />
        <StatusRow label="Data" value={DATA_PILL[backend].value} dot={DATA_PILL[backend].dot} />
      </div>
    </aside>
  )
}

function StatusRow({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="label">{label}</span>
      <span className="flex items-center gap-2 rounded-full border border-hairline px-2.5 py-1 font-mono text-[11px] text-ink-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        {value}
      </span>
    </div>
  )
}
