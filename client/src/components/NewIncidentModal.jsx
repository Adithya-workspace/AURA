import { useState } from 'react';
import { Button, Panel } from './ui.jsx';
import { api } from '../services/api.js';

const EXAMPLES = [
  { label: 'Payment failure', text: 'Customers are experiencing payment failures, checkout is slow, and some notifications are delayed. Investigate the incident and resolve everything you can.' },
  { label: 'Checkout degradation', text: 'Checkout is extremely slow and customers are seeing failed orders.' },
  { label: 'Inventory inconsistency', text: 'Inventory service is returning intermittent 500 errors.' },
  { label: 'Authentication outage', text: 'Users cannot sign in. Login tokens are being rejected.' },
  { label: 'Custom incident', text: '' },
];

export function SampleScenarioChips({ onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {['payments', 'authentication', 'orders', 'notifications'].map((key) => (
        <button key={key} className="rounded-full border border-border bg-surface px-3 py-1 text-xs capitalize hover:bg-subtle" onClick={() => onPick({ key })}>
          Demo: {key}
        </button>
      ))}
    </div>
  );
}

export function NewIncidentModal({ open, onClose, onCreate }) {
  const [description, setDescription] = useState('');
  const [service, setService] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [timeframe, setTimeframe] = useState('30m');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;

  async function readFiles(list) {
    const accepted = [...list].slice(0, 3);
    const loaded = [];
    for (const file of accepted) {
      if (!/\.(txt|log|json|csv)$/i.test(file.name)) throw new Error('Only .txt, .log, .json, and .csv files can be attached');
      if (file.size > 80000) throw new Error(`${file.name} is larger than 80KB`);
      const content = await file.text();
      loaded.push({ filename: file.name, content });
    }
    setFiles(loaded);
  }

  async function submit(scenarioKey) {
    setBusy(true);
    setError('');
    try {
      const body = scenarioKey
        ? { scenarioKey }
        : { description, service, environment, timeframe, evidence: files };
      const result = await api.createIncident(body);
      onCreate(result.incident);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-40 grid place-items-center p-4" onClick={onClose}>
      <Panel className="modal-card w-full max-w-xl p-5" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-base font-medium">New incident</h2>
        <p className="mt-1 text-sm text-muted">Give AURA the symptoms, objective, affected service, or any available context.</p>
        <label className="mt-4 block text-xs text-muted" htmlFor="inc-desc">What's happening?</label>
        <textarea id="inc-desc" className="mt-1 h-36 w-full rounded-md border border-border px-3 py-2 text-sm" placeholder="Describe what is happening..." value={description} onChange={(event) => setDescription(event.target.value)} />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-muted">Service
            <input className="mt-1 w-full rounded-md border border-border px-2 py-1 text-sm" value={service} placeholder="Auto-detect" onChange={(event) => setService(event.target.value)} />
          </label>
          <label className="text-xs text-muted">Environment
            <input className="mt-1 w-full rounded-md border border-border px-2 py-1 text-sm" value={environment} onChange={(event) => setEnvironment(event.target.value)} />
          </label>
          <label className="text-xs text-muted">Time range
            <input className="mt-1 w-full rounded-md border border-border px-2 py-1 text-sm" value={timeframe} onChange={(event) => setTimeframe(event.target.value)} />
          </label>
        </div>
        <label className="mt-3 block text-xs text-muted">Evidence
          <input className="mt-1 block w-full text-sm" type="file" accept=".txt,.log,.json,.csv" multiple onChange={(event) => readFiles(event.target.files).catch((err) => setError(err.message))} />
        </label>
        {files.length ? <p className="mt-1 text-xs text-muted">{files.map((file) => file.filename).join(', ')}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button key={example.label} className="rounded-full border border-border bg-surface px-3 py-1 text-xs hover:bg-subtle" onClick={() => setDescription(example.text)}>
              {example.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs text-muted">Deterministic demo environments</div>
          <SampleScenarioChips onPick={(scenario) => submit(scenario.key)} />
        </div>
        {error ? <p className="mt-2 text-sm text-critical">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !description.trim()} onClick={() => submit()}>Investigate incident</Button>
        </div>
      </Panel>
    </div>
  );
}
