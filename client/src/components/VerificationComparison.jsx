import { formatMs, formatPct } from '../lib/format.js';
import { useTween } from './ConfidenceMeter.jsx';

function Cell({ value, kind }) {
  const tween = useTween(typeof value === 'number' ? value : 0);
  if (typeof value !== 'number') return '—';
  if (kind === 'pct') return formatPct(tween);
  if (kind === 'ms') return formatMs(tween);
  if (kind === 'resource') return value <= 1.5 ? formatPct(tween) : `${Math.round(tween)}`;
  return String(Math.round(tween));
}

export function VerificationComparison({ verification }) {
  if (!verification) return null;
  const before = verification.before || {};
  const after = verification.after || {};
  const rows = [
    ['Error rate', before.errorRate, after.errorRate, 'pct'],
    ['Latency', before.latencyMs, after.latencyMs, 'ms'],
    [before.resourceLabel || 'Resource', before.resource, after.resource, 'resource'],
  ];
  const banner = {
    CONFIRMED: ['bg-[#eef8f0] text-success', '✓ Recovery confirmed'],
    PARTIAL: ['bg-[#fff6eb] text-warning', '! Partial recovery'],
    NOT_CONFIRMED: ['bg-[#fff1f1] text-critical', '✕ Not confirmed'],
  }[verification.verdict] || ['bg-subtle text-text', verification.verdict];
  return (
    <div className="feed-row overflow-hidden rounded-lg border border-border bg-surface">
      <div className={`px-3 py-2 text-sm font-medium ${banner[0]}`}>{banner[1]}</div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr><th className="px-3 py-2 font-medium">Metric</th><th className="px-3 py-2 font-medium">Before</th><th className="px-3 py-2 font-medium">After</th><th className="px-3 py-2 font-medium">Change</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, from, to, kind]) => (
            <tr key={label} className="border-t border-border">
              <td className="px-3 py-2">{label}</td>
              <td className="px-3 py-2 font-mono"><Cell value={from} kind={kind} /></td>
              <td className="px-3 py-2 font-mono"><Cell value={to} kind={kind} /></td>
              <td className="px-3 py-2 font-mono text-muted">{typeof from === 'number' && typeof to === 'number' ? <Cell value={to - from} kind={kind} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
