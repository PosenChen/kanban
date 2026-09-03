import { HashRouter, Routes, Route } from 'react-router-dom'
import GanttPage from './pages/GanttPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import DailyPage from './pages/DailyPage'
import ArchivePage from './pages/ArchivePage'
import LedgerPage from './pages/LedgerPage'
import MemoPage from './pages/MemoPage'
import SettingsPage from './pages/SettingsPage'
import KanbanBoard from './pages/KanbanBoard'
import ThemeToggle from './components/ThemeToggle'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GanttPage />} />
        <Route path="/board" element={<KanbanBoard />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="/daily/:date?" element={<DailyPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/memo" element={<MemoPage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <ThemeToggle />
    </HashRouter>
  )
}

export default App
