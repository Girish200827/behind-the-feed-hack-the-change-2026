import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { Lightbulb, ShieldCheck, Target } from 'lucide-react'
import Layout from './components/Layout'
import SessionReport from './pages/SessionReport'
import PlaceholderPage from './pages/PlaceholderPage'

// HashRouter so routes work when Electron loads the built index.html from disk.
// MotionConfig "user" turns transform/layout animations off under prefers-reduced-motion.
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/report" replace />} />
            <Route path="/report" element={<SessionReport />} />
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
            <Route
              path="/goals"
              element={
                <PlaceholderPage
                  icon={Target}
                  title="Goals"
                  text="A gentle weekly goal, shaped by the patterns in your sessions, will live here."
                />
              }
            />
            <Route path="*" element={<Navigate to="/report" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </MotionConfig>
  )
}
