import { useEffect, useState } from 'react';
import { Badge, ErrorState, Panel, Skeleton } from '../components/ui.jsx';
import { api } from '../services/api.js';

export function Tools() {
  const [tools, setTools] = useState(null);
  const [error, setError] = useState(null);
  async function load() {
    try { setTools((await api.tools()).tools); setError(null); } catch (err) { setError(err); }
  }
  useEffect(() => { load(); }, []);
  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!tools) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tools</h1>
        <p className="mt-1 text-sm text-muted">Read tools run on their own. Write tools wait for approval. Destructive tools are blocked.</p>
      </div>
      <div className="grid gap-3">
        {tools.map((tool) => (
          <Panel key={tool.name} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-sm">{tool.name}</h2>
              <Badge tone={tool.safety}>{tool.safety}</Badge>
              <Badge>{tool.agentRole}</Badge>
              <span className="text-xs text-muted">{tool.usageCount} uses</span>
            </div>
            <p className="mt-2 text-sm">{tool.description}</p>
            <p className="mt-2 text-xs text-muted">Applies to {tool.appliesTo.join(', ')}</p>
            <p className="mt-1 font-mono text-[11px] text-muted">{JSON.stringify(tool.input)}</p>
            {tool.approval ? <p className="mt-2 text-xs text-warning">Needs human approval before it can change infrastructure.</p> : null}
            {tool.blocked ? <p className="mt-2 text-xs text-critical">Always refused. Destructive operations are disabled.</p> : null}
          </Panel>
        ))}
      </div>
    </div>
  );
}
