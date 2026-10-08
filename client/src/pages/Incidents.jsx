import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SampleScenarioChips } from '../components/NewIncidentModal.jsx';
import { Button, EmptyState, ErrorState, Panel, Skeleton, StatusPill } from '../components/ui.jsx';
import { api } from '../services/api.js';
import { formatWhen } from '../lib/format.js';
import { NewIncidentModal } from '../components/NewIncidentModal.jsx';

export function Incidents() {
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function load() {
    setError(null);
    setRows(null);
    try {
      const body = await api.incidents({ status, severity });
      setRows(body.incidents);
    } catch (err) {
      setError(err);
    }
  }

  useEffect(() => { load(); }, [status, severity]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Incidents</h1>
        <Button onClick={() => setOpen(true)}>New Incident</Button>
      </div>
      <div className="flex gap-2">
        <select className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {['open', 'investigating', 'problems_discovered', 'root_cause_identified', 'awaiting_approval', 'remediating', 'verifying', 'adapting', 'resolved', 'partially_resolved', 'escalated'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter by severity">
          <option value="">All severities</option>
          {['low', 'medium', 'high', 'critical'].map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      {error ? <ErrorState message={error.message} onRetry={load} /> : null}
      {!rows && !error ? <Skeleton className="h-48" /> : null}
      {rows && rows.length === 0 ? (
        <EmptyState title="No incidents match" body="Start from a sample scenario." action={<SampleScenarioChips onPick={async (scenario) => {
          const created = await api.createIncident({ scenarioKey: scenario.key });
          navigate(`/incidents/${created.incident.id}?run=1`);
        }} />} />
      ) : null}
      {rows?.length ? (
        <Panel>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="px-3 py-2">Title</th><th>Severity</th><th>Status</th><th>Started</th></tr></thead>
            <tbody>
              {rows.map((incident) => (
                <tr key={incident.id} className="cursor-pointer border-t border-border hover:bg-subtle" onClick={() => navigate(`/incidents/${incident.id}`)}>
                  <td className="px-3 py-2">{incident.title}</td>
                  <td><StatusPill status={incident.severity} /></td>
                  <td><StatusPill status={incident.status} /></td>
                  <td className="font-mono text-xs">{formatWhen(incident.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
      <NewIncidentModal open={open} onClose={() => setOpen(false)} onCreate={(incident) => navigate(`/incidents/${incident.id}?run=1`)} />
    </div>
  );
}
