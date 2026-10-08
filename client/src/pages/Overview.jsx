import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChatbotVsAura } from '../components/ChatbotVsAura.jsx';
import { Button, EmptyState, ErrorState, Panel, Skeleton, StatCard, StatusPill } from '../components/ui.jsx';
import { NewIncidentModal } from '../components/NewIncidentModal.jsx';
import { useStats } from '../hooks/useStats.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { api } from '../services/api.js';
import { PACING_KEY } from '../lib/constants.js';
import { formatWhen } from '../lib/format.js';

export function Overview() {
  const { data, error, loading, reload } = useStats();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(params.get('intake') === '1');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toasts = useToasts();

  async function demo() {
    setBusy(true);
    try {
      const pacing = localStorage.getItem(PACING_KEY) || 'normal';
      const result = await api.demo({ pacing });
      toasts.push('Demo incident started');
      navigate(`/incidents/${result.incidentId}`);
    } catch (err) {
      toasts.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="grid gap-3 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24" />)}</div>;
  }
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const rate = `${Math.round((data.successRate || 0) * 100)}%`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AURA — Autonomous Incident Response</h1>
          <p className="mt-1 text-sm text-muted">An agent that investigates, asks before it changes anything, and checks that the fix worked.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setOpen(true)}>New Incident</Button>
          <Button disabled={busy} onClick={demo}>Run Demo Incident</Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="System Status" value="Operational" />
        <StatCard label="Active Incidents" value={data.activeIncidents} />
        <StatCard label="Resolved Today" value={data.resolvedToday} />
        <StatCard label="Agent Success Rate" value={rate} hint="Resolved / finished, from the database" />
      </div>
      <Panel className="p-4">
        <h2 className="text-sm font-medium">Active incident</h2>
        {data.active?.[0] ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm">{data.active[0].title}</div>
              <div className="mt-1 text-xs text-muted">Started {formatWhen(data.active[0].createdAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={data.active[0].severity} />
              <StatusPill status={data.active[0].status} />
              <Button variant="secondary" onClick={() => navigate(`/incidents/${data.active[0].id}`)}>Open Incident</Button>
            </div>
          </div>
        ) : <p className="mt-2 text-sm text-muted">No active incident. Run the payment demo to watch the agent work.</p>}
      </Panel>
      <div className="flex flex-wrap gap-3">
        {data.services?.map((service) => (
          <div key={service.name} className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs">
            <span className={`h-1.5 w-1.5 rounded-full ${service.status === 'HEALTHY' ? 'bg-success' : 'bg-warning'}`} />
            {service.name}
          </div>
        ))}
      </div>
      <Panel className="p-4">
        <h2 className="text-sm font-medium">Recent incidents</h2>
        <ul className="mt-3 divide-y divide-border">
          {data.recent?.length ? data.recent.map((incident) => (
            <li key={incident.id}>
              <button className="flex w-full items-center justify-between py-2 text-left text-sm hover:bg-subtle" onClick={() => navigate(`/incidents/${incident.id}`)}>
                <span>{incident.title}</span>
                <StatusPill status={incident.status} />
              </button>
            </li>
          )) : <EmptyState title="No incidents yet" body="Create one from a sample scenario." />}
        </ul>
      </Panel>
      <ChatbotVsAura />
      <NewIncidentModal open={open} onClose={() => setOpen(false)} onCreate={(incident) => navigate(`/incidents/${incident.id}?run=1`)} />
    </div>
  );
}
