import { Button } from './ui.jsx';
import { reportUrl } from '../services/api.js';
import { formatDuration, formatPct, formatMs } from '../lib/format.js';

export function IncidentReport({ incidentId, report, markdown, durationMs }) {
  if (!report) return null;
  const verification = report.verification;
  async function download() {
    const response = await fetch(reportUrl(incidentId, 'md'));
    const text = await response.text();
    const blob = new Blob([text || markdown || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${incidentId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="feed-row rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Incident report</h3>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={download}>Download Markdown</Button>
          <Button variant="secondary" onClick={() => window.open(reportUrl(incidentId, 'html'), '_blank', 'noopener')}>Print / PDF</Button>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted">Incident</dt><dd>{report.incident?.title}</dd></div>
        <div><dt className="text-xs text-muted">Root cause</dt><dd>{report.rootCause}</dd></div>
        <div><dt className="text-xs text-muted">Confidence</dt><dd>{report.confidence ?? '—'}</dd></div>
        <div><dt className="text-xs text-muted">Duration</dt><dd>{formatDuration(report.durationMs || durationMs)}</dd></div>
        <div><dt className="text-xs text-muted">Evidence signals</dt><dd>{report.evidenceCount ?? report.evidence?.length ?? 0}</dd></div>
        <div><dt className="text-xs text-muted">Actions</dt><dd>{report.actions?.map((action) => action.title).join('; ') || 'None'}</dd></div>
      </dl>
      {verification ? (
        <p className="mt-3 font-mono text-xs text-muted">
          {formatPct(verification.before.errorRate)} → {formatPct(verification.after.errorRate)} · {formatMs(verification.before.latencyMs)} → {formatMs(verification.after.latencyMs)} · {verification.verdict}
        </p>
      ) : null}
    </section>
  );
}
