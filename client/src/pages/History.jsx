import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, Panel, Skeleton, StatusPill } from '../components/ui.jsx';
import { api } from '../services/api.js';
import { formatWhen } from '../lib/format.js';

export function History() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  async function load() {
    try {
      const body = await api.incidents();
      setRows(body.incidents.filter((incident) => incident.status === 'resolved' || incident.status === 'escalated'));
      setError(null);
    } catch (err) { setError(err); }
  }
  useEffect(() => { load(); }, []);
  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!rows) return <Skeleton className="h-48" />;
  if (!rows.length) return <EmptyState title="No history yet" body="Resolved and escalated incidents will land here with their reports." />;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">History</h1>
      {rows.map((incident) => (
        <Panel key={incident.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div>
            <div>{incident.title}</div>
            <div className="text-xs text-muted">{formatWhen(incident.resolved_at || incident.created_at)}</div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={incident.status} />
            <Link className="text-accent" to={`/incidents/${incident.id}`}>Open</Link>
            <a className="text-accent" href={`/api/incidents/${incident.id}/report?format=md`}>Report</a>
          </div>
        </Panel>
      ))}
    </div>
  );
}
