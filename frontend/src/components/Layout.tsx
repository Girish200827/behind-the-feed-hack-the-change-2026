import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { CloudOff } from 'lucide-react'
import Sidebar from './Sidebar'
import { useBackendStatus } from '../hooks/useBackendStatus'

const TITLES: Record<string, string> = {
  '/today': 'Today',
  '/session': 'Session',
  '/privacy': 'Privacy',
  '/insights': 'Insights',
  '/goals': 'Goals',
  '/circle': 'Circle'
}

export default function Layout() {
  const { pathname } = useLocation()
  const backend = useBackendStatus()
  return (
    <div className="flex h-full bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Title strip: draggable, sits under the native window controls on Windows. */}
        <header className="drag flex h-[var(--titlebar-h)] shrink-0 items-center px-10">
          <span className="label">{TITLES['/' + pathname.split('/')[1]] ?? ''}</span>
          {backend === 'offline' && (
            <span
              role="status"
              className="no-drag ml-4 flex items-center gap-2 rounded-full border border-dashed border-hairline-strong px-3 py-1 text-[12px] text-ink-2"
            >
              <CloudOff size={13} className="text-negative-ink" />
              Backend offline – showing demo data
            </span>
          )}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <motion.div
            key={pathname.split('/')[1]}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-[1200px] px-10 pb-16 pt-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
