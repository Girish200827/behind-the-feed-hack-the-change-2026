import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { Activity, Lightbulb, ShieldCheck, Target, type LucideIcon } from 'lucide-react'
import { dataSourceName } from '../data'
import Wordmark from './Wordmark'

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/report', label: 'Session Report', icon: Activity },
  { to: '/privacy', label: 'Privacy', icon: ShieldCheck },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/goals', label: 'Goals', icon: Target }
]

export default function Sidebar() {
  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-hairline">
      <div className="drag flex h-[var(--titlebar-h)] items-center px-5" />
      <div className="px-5 pb-8 pt-2">
        <Wordmark />
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] outline-none transition-colors duration-150 focus-visible:outline-1 focus-visible:outline-accent"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md border border-hairline bg-surface-2"
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  />
                )}
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={`relative transition-colors ${isActive ? 'text-accent' : 'text-muted group-hover:text-ink-2'}`}
                />
                <span
                  className={`relative transition-colors ${
                    isActive ? 'font-medium text-ink' : 'text-muted group-hover:text-ink-2 group-active:text-ink'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-hairline px-5 py-5">
        <StatusRow label="Data" value={dataSourceName === 'mock' ? 'Demo' : 'Live'} dot={dataSourceName === 'mock' ? 'var(--accent)' : 'var(--positive)'} />
        <StatusRow label="Camera" value="Off" dot="var(--faint)" />
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
