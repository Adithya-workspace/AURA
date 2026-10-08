import { incidentsRepo } from '../database/repositories/incidents.js';
import { runsRepo } from '../database/repositories/runs.js';
import { remediationsRepo } from '../database/repositories/remediations.js';
import { verificationsRepo } from '../database/repositories/verifications.js';
import { eventsRepo } from '../database/repositories/events.js';
import { problemsRepo } from '../database/repositories/problems.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function buildReport(incidentId) {
  const incident = incidentsRepo.get(incidentId);
  if (!incident) return null;
  const runs = runsRepo.forIncident(incidentId);
  const run = runs[0];
  const events = eventsRepo.list(incidentId, 0);
  const root = events.find((event) => event.type === 'root_cause_identified');
  const verifications = run ? verificationsRepo.forRun(run.id) : [];
  const verification = verifications.at(-1) || null;
  const actions = remediationsRepo.forIncident(incidentId).filter((item) => item.status === 'executed');
  const rejected = remediationsRepo.forIncident(incidentId).filter((item) => item.status === 'rejected');
  const problems = problemsRepo.list(incidentId);
  const approvals = events.filter((event) => event.type === 'approval_granted').length;
  const started = run?.started_at || incident.created_at;
  const ended = run?.ended_at || incident.resolved_at || Date.now();
  const data = {
    incident: {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      severity: incident.severity,
      status: incident.status,
    },
    rootCause: root?.payload?.rootCause || 'Not determined',
    confidence: root?.payload?.confidence ?? null,
    evidence: root?.payload?.evidence || [],
    actions: actions.map((action) => ({ title: action.title, tool: action.tool, args: action.args, risk: action.risk })),
    verification: verification
      ? { verdict: verification.verdict, before: verification.before, after: verification.after }
      : null,
    durationMs: ended - started,
    evidenceCount: (root?.payload?.evidence || []).length,
    problems,
    problemsDiscovered: problems.length,
    problemsResolved: problems.filter((problem) => problem.status === 'resolved').length,
    remaining: problems.filter((problem) => problem.status !== 'resolved' && problem.type !== 'unrelated').map((problem) => problem.title),
    approvals,
    rejected: rejected.map((action) => action.title),
    provider: run?.llm_provider || 'mock',
  };

  const lines = [
    `# AURA incident report`,
    ``,
    `## Incident`,
    `- Title: ${data.incident.title}`,
    `- Status: ${data.incident.status}`,
    `- Severity: ${data.incident.severity || 'unknown'}`,
    `- Category: ${data.incident.category || 'unknown'}`,
    ``,
    `## Initial symptoms`,
    data.incident.description,
    ``,
    `## Problems discovered`,
    ...(data.problems.length ? data.problems.map((problem) => `- ${problem.type}: ${problem.title} (${problem.status})`) : ['- None persisted']),
    ``,
    `## Root cause`,
    data.rootCause,
    ``,
    `Confidence: ${data.confidence ?? 'n/a'}`,
    ``,
    `## Evidence`,
    ...(data.evidence.length ? data.evidence.map((item) => `- ${item.signal}: ${item.detail} (weight ${item.weight})`) : ['- None recorded']),
    ``,
    `## Actions`,
    ...(data.actions.length ? data.actions.map((action) => `- ${action.title} (${action.tool}, risk ${action.risk})`) : ['- None executed']),
    ``,
    `## Actions rejected`,
    ...(data.rejected.length ? data.rejected.map((title) => `- ${title}`) : ['- None']),
    ``,
    `## Remaining issues`,
    ...(data.remaining.length ? data.remaining.map((title) => `- ${title}`) : ['- None']),
    ``,
    `Human approvals: ${data.approvals}`,
    `Problems discovered: ${data.problemsDiscovered}`,
    `Problems resolved: ${data.problemsResolved}`,
    ``,
    `## Verification`,
    verification
      ? `- Verdict: ${verification.verdict}\n- Error rate: ${pct(verification.before.errorRate)} → ${pct(verification.after.errorRate)}\n- Latency: ${Math.round(verification.before.latencyMs)}ms → ${Math.round(verification.after.latencyMs)}ms\n- ${verification.before.resourceLabel}: ${verification.before.resource} → ${verification.after.resource}`
      : '- Not run',
    ``,
    `Duration: ${Math.round(data.durationMs / 1000)}s`,
  ];

  return { markdown: lines.join('\n'), data };
}

export function reportHtml(report) {
  const { data } = report;
  const before = data.verification?.before;
  const after = data.verification?.after;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.incident.title)}</title>
  <style>
    body { font-family: Inter, Segoe UI, sans-serif; color: #1F1F1D; margin: 32px; }
    h1 { font-size: 22px; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #E7E4DE; padding: 8px; text-align: left; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>AURA incident report</h1>
  <p>${escapeHtml(data.incident.title)} · ${escapeHtml(data.incident.status)}</p>
  <h2>Root cause</h2>
  <p>${escapeHtml(data.rootCause)}</p>
  <p>Confidence ${escapeHtml(data.confidence)}</p>
  <h2>Before / after</h2>
  <table>
    <tr><th>Metric</th><th>Before</th><th>After</th></tr>
    <tr><td>Error rate</td><td>${before ? pct(before.errorRate) : '—'}</td><td>${after ? pct(after.errorRate) : '—'}</td></tr>
    <tr><td>Latency</td><td>${before ? `${Math.round(before.latencyMs)}ms` : '—'}</td><td>${after ? `${Math.round(after.latencyMs)}ms` : '—'}</td></tr>
    <tr><td>${escapeHtml(before?.resourceLabel || 'Resource')}</td><td>${before ? before.resource : '—'}</td><td>${after ? after.resource : '—'}</td></tr>
  </table>
</body>
</html>`;
}
