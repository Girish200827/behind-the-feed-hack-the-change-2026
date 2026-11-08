import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import Sidebar from './Sidebar'

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
  return (
    <div className="flex h-full bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Title strip: draggable, sits under the native window controls on Windows. */}
        <header className="drag flex h-[var(--titlebar-h)] shrink-0 items-center px-10">
          <span className="label">{TITLES['/' + pathname.split('/')[1]] ?? ''}</span>
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
