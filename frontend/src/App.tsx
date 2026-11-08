import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import Layout from './components/Layout'
import SessionReport from './pages/SessionReport'
import TodayPage from './pages/TodayPage'
import InsightsPage from './pages/InsightsPage'
import GoalsPage from './pages/GoalsPage'
import CirclePage from './pages/CirclePage'
import { FEATURES } from './config/features'
import PrivacyPage from './pages/PrivacyPage'
import NudgeProvider from './components/nudge/NudgeProvider'
import ConsentGate from './components/ConsentGate'

// HashRouter so routes work when Electron loads the built index.html from disk.
// MotionConfig "user" turns transform/layout animations off under prefers-reduced-motion.
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ConsentGate>
      <HashRouter>
        <NudgeProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/session/:id" element={<SessionReport />} />
            <Route path="/report" element={<Navigate to="/today" replace />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            {/* Scroll Circle is behind VITE_ENABLE_CIRCLE (src/config/features.ts); when off, /circle goes to Today. */}
            <Route path="/circle" element={FEATURES.circle ? <CirclePage /> : <Navigate to="/today" replace />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Route>
        </Routes>
        </NudgeProvider>
      </HashRouter>
      </ConsentGate>
    </MotionConfig>
  )
}
