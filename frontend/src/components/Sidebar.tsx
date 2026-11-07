import { NavLink } from 'react-router-dom'
import { dataSourceName } from '../data'

const NAV = [
  { to: '/report', label: 'Session Report' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/insights', label: 'Insights' },
  { to: '/goals', label: 'Goals' }
]

export default function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface px-4 py-6">
      <div className="mb-8 px-2">
        <div className="text-lg font-semibold tracking-tight">Scroll Mood</div>
        <div className="text-xs text-muted">How scrolling shifts your mood</div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 text-xs text-muted">
        {dataSourceName === 'mock' ? 'Showing demo data' : 'Live data'}
      </div>
    </aside>
  )
}
