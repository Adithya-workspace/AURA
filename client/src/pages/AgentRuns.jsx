import { useEffect, useState } from 'react';
import { ErrorState, Panel, Skeleton, StatusPill } from '../components/ui.jsx';
import { api } from '../services/api.js';
import { formatDuration, formatWhen } from '../lib/format.js';

export function AgentRuns() {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);

  async function load() {
    try {
      setRuns((await api.runs()).runs);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggle(id) {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    setDetail(null);
    try { setDetail(await api.runDetail(id)); } catch (err) { setError(err); }
  }

  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!runs) return <Skeleton className="h-48" />;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Agent runs</h1>
      {runs.length === 0 ? <p className="text-sm text-muted">No runs yet.</p> : null}
      {runs.map((run) => (
        <Panel key={run.id}>
          <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm" onClick={() => toggle(run.id)}>
            <span className="font-mono text-xs">{run.incident_id}</span>
            <StatusPill status={run.status} />
            <span className="text-muted">{run.llm_provider}</span>
            <span className="font-mono text-xs">{formatDuration((run.ended_at || Date.now()) - run.started_at)}</span>
            <span>{run.tools} tools</span>
            <span>{run.attempts} attempts</span>
          </button>
          {open === run.id && detail?.run?.id === run.id ? (
            <div className="border-t border-border px-4 py-3 text-sm">
              <div className="text-xs text-muted">Started {formatWhen(run.started_at)}</div>
              <ul className="mt-2 space-y-1">
                {detail.executions.map((item) => (
                  <li key={item.id} className="font-mono text-xs">{item.tool} · {item.status} · {item.duration_ms}ms</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}
