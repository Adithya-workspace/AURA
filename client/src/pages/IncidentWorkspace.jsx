import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ActivityFeed } from '../components/ActivityFeed.jsx';
import { ApprovalCard } from '../components/ApprovalCard.jsx';
import { EvidencePanel } from '../components/EvidencePanel.jsx';
import { ExecutionProgress } from '../components/ExecutionProgress.jsx';
import { IncidentReport } from '../components/IncidentReport.jsx';
import { PlanList } from '../components/PlanList.jsx';
import { ProblemGraph } from '../components/ProblemGraph.jsx';
import { StageStepper } from '../components/StageStepper.jsx';
import { ToolCard } from '../components/ToolCard.jsx';
import { VerificationComparison } from '../components/VerificationComparison.jsx';
import { Button, ErrorState, Panel, Skeleton, StatusPill } from '../components/ui.jsx';
import { useIncident } from '../hooks/useIncident.js';
import { useIncidentStream } from '../hooks/useIncidentStream.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { PACING_KEY } from '../lib/constants.js';
import { formatWhen } from '../lib/format.js';
import { api } from '../services/api.js';

export function IncidentWorkspace() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const { data, error, loading, reload } = useIncident(id);
  const { view, transport } = useIncidentStream(id);
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('workflow');
  const toasts = useToasts();
  const incident = data?.incident;
  useEffect(() => {
    if (view.status === 'resolved' || view.status === 'escalated' || view.status === 'partially_resolved') reload();
  }, [view.status]);
  useEffect(() => {
    if (!incident || search.get('run') !== '1' || incident.status !== 'open') return;
    const key = `aura.autostart.${incident.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    run();
  }, [incident?.id, incident?.status]);

  async function run() {
    setBusy(true);
    try {
      await api.run(id, { pacing: localStorage.getItem(PACING_KEY) || 'normal', partialRecovery: partial });
      toasts.push('Agent started');
      reload();
    } catch (err) {
      toasts.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    try {
      await api.approve(id, view.approval.remediationId);
      toasts.push('Action authorized');
    } catch (err) {
      toasts.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await api.reject(id, view.approval.remediationId, 'Rejected from the workspace');
      toasts.push('Action rejected');
    } catch (err) {
      toasts.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!incident) return null;

  const running = ['investigating', 'awaiting_approval', 'remediating', 'verifying'].includes(incident.status) || ['investigating', 'awaiting_approval', 'remediating'].includes(view.status);
  const activeTools = view.tools.filter((tool) => ['investigate', 'verify', 'report', 'act'].includes(tool.stage) || true);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{incident.title}</h1>
        <div className="flex items-center gap-2 text-xs text-muted">
          <StatusPill status={view.status !== 'idle' ? view.status : incident.status} />
          <span className="font-mono">{transport}</span>
        </div>
      </div>
      <div className="flex gap-2 lg:hidden">
        {['workflow', 'activity', 'evidence'].map((item) => (
          <button key={item} className={`rounded-md px-3 py-1 text-sm capitalize ${tab === item ? 'bg-accent text-white' : 'bg-surface border border-border'}`} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Panel className={`p-4 ${tab === 'workflow' ? '' : 'hidden xl:block'}`}>
          <div className="space-y-2 text-sm">
            <Row label="Severity" value={view.severity || incident.severity} />
            <Row label="Started" value={formatWhen(incident.created_at)} />
            <Row label="Category" value={view.category || incident.category} />
            <Row label="Services" value={(view.affectedServices.length ? view.affectedServices : []).join(', ') || '—'} />
          </div>
          <p className="mt-3 text-sm text-muted">{incident.description}</p>
          <p className="mt-2 text-sm">{view.objective}</p>
          <h2 className="mb-2 mt-4 text-xs uppercase text-muted">Discovered problems</h2>
          {(view.problems || []).length ? (
            <ul className="space-y-2 text-sm">
              {view.problems.filter((problem) => problem.type !== 'unrelated').map((problem) => (
                <li key={problem.id} className="flex items-start justify-between gap-2">
                  <span>{problem.title}</span>
                  <span className="text-xs uppercase text-muted">{problem.status}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">None yet.</p>}
          <h2 className="mb-2 mt-4 text-xs uppercase text-muted">Plan</h2>
          <PlanList plan={view.plan} />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={partial} onChange={(event) => setPartial(event.target.checked)} />
            Partial recovery
          </label>
          <Button className="mt-3 w-full" disabled={busy || running} onClick={run}>{view.error ? 'Re-run agent' : 'Run Agent'}</Button>
          {view.error ? <p className="mt-2 text-sm text-critical">{view.error}</p> : null}
        </Panel>
        <div className={`${tab === 'workflow' ? '' : 'hidden lg:block'} space-y-4`}>
          <Panel className="p-4">
            <StageStepper stages={view.stages} />
          </Panel>
          {view.adapting ? <Panel className="border-warning/40 p-3 text-sm">Adapting: {view.adapting.reason}</Panel> : null}
          <div className="space-y-3">
            {activeTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
            <ApprovalCard approval={view.approval} busy={busy} onApprove={approve} onReject={reject} />
            <ExecutionProgress steps={view.execution} />
            <VerificationComparison verification={view.verification} />
            <IncidentReport incidentId={id} report={view.report} markdown={view.markdown} />
          </div>
        </div>
        <Panel className={`p-4 ${tab === 'evidence' || tab === 'activity' ? '' : 'hidden xl:block'} xl:sticky xl:top-4 xl:self-start`}>
          <div className={tab === 'activity' ? 'hidden xl:block' : ''}>
            <h2 className="mb-2 text-xs uppercase text-muted">Problem graph</h2>
            <ProblemGraph problems={view.problems || []} />
            <EvidencePanel view={view} />
          </div>
          <h2 className="mb-2 mt-4 text-xs uppercase text-muted">Activity</h2>
          <div className={tab === 'evidence' ? 'hidden xl:block' : ''}>
            <ActivityFeed items={view.activity} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between gap-3"><span className="text-muted">{label}</span><span className="text-right">{value || '—'}</span></div>;
}
