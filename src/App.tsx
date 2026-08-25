import { HashRouter, Routes, Route } from 'react-router-dom'
import GanttPage from './pages/GanttPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import DailyPage from './pages/DailyPage'
import SettingsPage from './pages/SettingsPage'
import KanbanBoard from './pages/KanbanBoard'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GanttPage />} />
        <Route path="/board" element={<KanbanBoard />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="/daily/:date?" element={<DailyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
