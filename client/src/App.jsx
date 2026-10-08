import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout.jsx';
import { AgentRuns } from './pages/AgentRuns.jsx';
import { History } from './pages/History.jsx';
import { IncidentWorkspace } from './pages/IncidentWorkspace.jsx';
import { Incidents } from './pages/Incidents.jsx';
import { Landing } from './pages/Landing.jsx';
import { Overview } from './pages/Overview.jsx';
import { Settings } from './pages/Settings.jsx';
import { SignIn } from './pages/SignIn.jsx';
import { Tools } from './pages/Tools.jsx';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route element={<AppLayout />}>
        <Route path="/app" element={<Overview />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/:id" element={<IncidentWorkspace />} />
        <Route path="/runs" element={<AgentRuns />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
