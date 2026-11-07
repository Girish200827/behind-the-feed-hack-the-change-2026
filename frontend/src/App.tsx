import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import SessionReport from './pages/SessionReport'
import PlaceholderPage from './pages/PlaceholderPage'

// HashRouter so routes work when Electron loads the built index.html from disk.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/report" replace />} />
          <Route path="/report" element={<SessionReport />} />
          <Route
            path="/privacy"
            element={<PlaceholderPage title="Privacy" text="What the camera watches, what is saved, and a pause button. Coming next." />}
          />
          <Route
            path="/insights"
            element={<PlaceholderPage title="Insights" text="Which content tends to lift or drain your mood will show here once you have a few sessions." />}
          />
          <Route
            path="/goals"
            element={<PlaceholderPage title="Goals" text="A gentle weekly goal, based on your patterns, will show here." />}
          />
          <Route path="*" element={<Navigate to="/report" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
