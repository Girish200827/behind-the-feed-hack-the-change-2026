import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { Lightbulb } from 'lucide-react'
import Layout from './components/Layout'
import SessionReport from './pages/SessionReport'
import TodayPage from './pages/TodayPage'
import PlaceholderPage from './pages/PlaceholderPage'
import GoalsPage from './pages/GoalsPage'
import CirclePage from './pages/CirclePage'
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
            <Route
              path="/insights"
              element={
                <PlaceholderPage
                  icon={Lightbulb}
                  title="Insights"
                  text="After a few sessions, this page shows which kinds of content tend to lift or drain your mood."
                />
              }
            />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/circle" element={<CirclePage />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Route>
        </Routes>
        </NudgeProvider>
      </HashRouter>
      </ConsentGate>
    </MotionConfig>
  )
}
