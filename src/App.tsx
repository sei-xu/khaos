import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import CalendarPage from './pages/CalendarPage';
import TagsPage from './pages/TagsPage';
import AssistantPage from './pages/AssistantPage';
import RoutinesPage from './pages/RoutinesPage';
import VaultIndexPage from './pages/dev/VaultIndexPage';
import PantheonPage from './pages/dev/PantheonPage';
import ChorusPage from './pages/dev/ChorusPage';
import WellspringPage from './pages/dev/WellspringPage';
import SigilsPage from './pages/dev/SigilsPage';
import ForgePage from './pages/dev/ForgePage';
import ThresholdPage from './pages/dev/ThresholdPage';
import EmblemPage from './pages/dev/EmblemPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/routines" element={<RoutinesPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
      </Route>
      {/* Not DEV-gated: the whole app sits behind PasswordGate, so the
          Vortex can ship in Vercel previews for review. */}
      <Route path="/dev/vortex" element={<VaultIndexPage />} />
      <Route path="/dev/vortex/pantheon" element={<PantheonPage />} />
      <Route path="/dev/vortex/chorus" element={<ChorusPage />} />
      <Route path="/dev/vortex/wellspring" element={<WellspringPage />} />
      <Route path="/dev/vortex/sigils" element={<SigilsPage />} />
      <Route path="/dev/vortex/forge" element={<ForgePage />} />
      <Route path="/dev/vortex/threshold" element={<ThresholdPage />} />
      <Route path="/dev/vortex/emblem" element={<EmblemPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
