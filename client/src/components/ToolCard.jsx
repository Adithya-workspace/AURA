import { Badge } from './ui.jsx';
import { prettyTool } from '../lib/format.js';
import { CollapsibleSection } from './ui.jsx';

const dot = { info: 'bg-muted', warning: 'bg-warning', critical: 'bg-critical' };

export function ToolCard({ tool }) {
  return (
    <article className="feed-row rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium capitalize">{prettyTool(tool.tool)}</div>
          <div className="font-mono text-[11px] text-muted">{tool.tool}</div>
        </div>
        <div className="flex items-center gap-2">
          {tool.role ? <Badge tone="info">{tool.role}</Badge> : null}
          <span className="font-mono text-[11px] text-muted">
            {tool.status === 'running' ? 'running' : tool.status}
            {tool.durationMs ? ` · ${tool.durationMs}ms` : ''}
          </span>
        </div>
      </div>
      {tool.why ? <p className="mt-2 text-sm text-muted">Why: {tool.why}</p> : null}
      {tool.status === 'running' ? <div className="mt-3 h-1 overflow-hidden rounded bg-subtle"><div className="h-full w-1/3 animate-pulse bg-accent" /></div> : null}
      {tool.error ? <p className="mt-2 text-sm text-critical">{tool.error}</p> : null}
      {tool.findings?.length ? (
        <ul className="mt-3 space-y-1">
          {tool.findings.slice(0, 4).map((finding) => (
            <li key={`${finding.label}-${finding.value}`} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot[finding.severity] || dot.info}`} />
              <span><span className="text-muted">{finding.label}: </span>{finding.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {tool.data ? (
        <CollapsibleSection title="Raw result">
          <pre className="overflow-auto font-mono text-[11px] text-muted">{JSON.stringify(tool.data, null, 2)}</pre>
        </CollapsibleSection>
      ) : null}
    </article>
  );
}
