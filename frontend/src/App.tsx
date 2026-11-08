import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { Lightbulb, ShieldCheck } from 'lucide-react'
import Layout from './components/Layout'
import SessionReport from './pages/SessionReport'
import TodayPage from './pages/TodayPage'
import PlaceholderPage from './pages/PlaceholderPage'
import GoalsPage from './pages/GoalsPage'

// HashRouter so routes work when Electron loads the built index.html from disk.
// MotionConfig "user" turns transform/layout animations off under prefers-reduced-motion.
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/session/:id" element={<SessionReport />} />
            <Route path="/report" element={<Navigate to="/today" replace />} />
            <Route
              path="/privacy"
              element={
                <PlaceholderPage
                  icon={ShieldCheck}
                  title="Privacy"
                  text="What the camera watches, what is kept, and what is never saved. You will be able to pause the camera from here."
                />
              }
            />
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
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </MotionConfig>
  )
}
