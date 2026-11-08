import { Link, useLocation } from 'react-router-dom'
import { Activity, Lightbulb, ShieldCheck, Target, Users, type LucideIcon } from 'lucide-react'
import { BrandMark } from './Wordmark'
import { FEATURES } from '../config/features'

export const ALL_NAV: { to: string; label: string; subtitle: string; icon: LucideIcon; also?: string[] }[] = [
  { to: '/today', label: 'Today', subtitle: 'How scrolling felt today', icon: Activity, also: ['/session'] },
  { to: '/insights', label: 'Insights', subtitle: 'What lifts you and what drains you', icon: Lightbulb },
  { to: '/goals', label: 'Goals', subtitle: 'One small change at a time', icon: Target },
  { to: '/privacy', label: 'Privacy', subtitle: 'What is and isn’t recorded', icon: ShieldCheck },
  { to: '/circle', label: 'Circle', subtitle: 'Scroll less, together', icon: Users }
]
// Scroll Circle only shows when VITE_ENABLE_CIRCLE=true (src/config/features.ts).
const NAV = ALL_NAV.filter((item) => item.to !== '/circle' || FEATURES.circle)

export const navItemFor = (pathname: string) =>
  NAV.find((item) => [item.to, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(p + '/')))

/** 56px icon rail: brand mark on top, one square icon button per page. Labels show as tooltips. */
export default function Sidebar() {
  const { pathname } = useLocation()
  const current = navItemFor(pathname)
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-hairline bg-surface-2">
      {/* room for the macOS window buttons; also a drag handle */}
      <div className="drag h-[var(--titlebar-h)] w-full shrink-0" />
      <div className="pb-6 pt-3">
        <BrandMark size={32} />
      </div>
      <nav className="flex flex-col items-center gap-2" aria-label="Main">
        {NAV.map((item) => {
          const { to, label, icon: Icon } = item
          const active = item === current
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-[10px] border outline-none transition-colors duration-150 ease-[var(--ease)] focus-visible:outline-1 focus-visible:outline-accent ${
                active
                  ? 'border-transparent bg-accent-soft text-accent'
                  : 'border-hairline bg-surface text-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
