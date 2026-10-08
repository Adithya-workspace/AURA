import { useEffect, useState } from 'react';
import { Button, ErrorState, Panel, Skeleton } from '../components/ui.jsx';
import { api } from '../services/api.js';
import { PACING_KEY } from '../lib/constants.js';
import { useToasts } from '../hooks/useToasts.jsx';

export function Settings() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [pacing, setPacing] = useState(() => localStorage.getItem(PACING_KEY) || 'normal');
  const toasts = useToasts();

  async function load() {
    try { setHealth(await api.health()); setError(null); } catch (err) { setError(err); }
  }
  useEffect(() => { load(); }, []);

  function savePacing(value) {
    setPacing(value);
    localStorage.setItem(PACING_KEY, value);
  }

  async function reset() {
    try {
      await api.reset();
      toasts.push('Demo data reset');
    } catch (err) {
      toasts.push(err.message, 'error');
    }
  }

  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!health) return <Skeleton className="h-40" />;
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Panel className="space-y-2 p-4 text-sm">
        <div>Provider: {health.ai.provider}</div>
        <div>Model: {health.ai.model}</div>
        <div>Status: {health.ai.mode}</div>
        <p className="text-muted">With no API key, AURA uses the deterministic fallback policy. Set AI_PROVIDER and AI_API_KEY on the server to use a live model.</p>
      </Panel>
      <Panel className="p-4">
        <h2 className="text-sm font-medium">Demo pacing</h2>
        <p className="mt-1 text-sm text-muted">This is simulated infrastructure latency around real tool calls. It is sent with the next run.</p>
        <div className="mt-3 flex gap-2">
          {['fast', 'normal', 'slow'].map((item) => (
            <button key={item} className={`rounded-md border px-3 py-1 text-sm capitalize ${pacing === item ? 'border-accent text-accent' : 'border-border'}`} onClick={() => savePacing(item)}>{item}</button>
          ))}
        </div>
      </Panel>
      <Panel className="p-4">
        <h2 className="text-sm font-medium">Demo data</h2>
        <p className="mt-1 text-sm text-muted">Clears incidents created in this session and keeps the seeded history.</p>
        <Button className="mt-3" variant="secondary" onClick={reset}>Reset demo data</Button>
      </Panel>
    </div>
  );
}
