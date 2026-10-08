import { ConfidenceMeter } from './ConfidenceMeter.jsx';
import { formatMs, formatPct } from '../lib/format.js';
import { CollapsibleSection } from './ui.jsx';

export function EvidencePanel({ view }) {
  const metrics = view.metrics;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs uppercase tracking-wide text-muted">Root cause</h3>
        <p className="mt-1 text-sm">{view.rootCause || 'Not identified yet.'}</p>
        <div className="mt-3"><ConfidenceMeter value={view.confidence} /></div>
      </div>
      <CollapsibleSection title="Evidence" defaultOpen>
        {view.evidence?.length ? (
          <ul className="space-y-2">
            {view.evidence.map((item) => (
              <li key={item.signal} className="text-sm">
                <span className="text-success">✓ </span>{item.signal}
                <div className="text-xs text-muted">{item.detail} · weight {item.weight}</div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Evidence accumulates as tools finish.</p>}
      </CollapsibleSection>
      <CollapsibleSection title="Ruled out">
        {view.ruledOut?.length ? view.ruledOut.map((item) => (
          <p key={item.hypothesis} className="mb-2 text-sm"><span className="font-medium">{item.hypothesis}.</span> <span className="text-muted">{item.reason}</span></p>
        )) : <p className="text-sm text-muted">None yet.</p>}
      </CollapsibleSection>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Error" value={metrics?.errorRate !== undefined ? formatPct(metrics.errorRate) : '—'} />
        <Metric label="Latency" value={metrics?.latencyMs !== undefined ? formatMs(metrics.latencyMs) : '—'} />
        <Metric label={metrics?.resourceLabel || 'Resource'} value={metrics?.resource !== undefined ? (metrics.resource <= 1.5 ? formatPct(metrics.resource) : String(Math.round(metrics.resource))) : '—'} />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md border border-border px-2 py-2">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className="font-mono text-xs">{value}</div>
    </div>
  );
}
