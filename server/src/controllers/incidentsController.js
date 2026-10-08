import { z } from 'zod';
import { incidentsRepo } from '../database/repositories/incidents.js';
import { runsRepo } from '../database/repositories/runs.js';
import { eventsRepo } from '../database/repositories/events.js';
import { remediationsRepo } from '../database/repositories/remediations.js';
import { verificationsRepo } from '../database/repositories/verifications.js';
import { reportsRepo } from '../database/repositories/reports.js';
import { buildScenario, classifyText, listScenarios } from '../simulation/scenarios/index.js';
import { cleanText } from '../utils/sanitize.js';
import { httpError } from '../utils/http.js';
import { startRun } from '../services/runService.js';
import { env } from '../config/env.js';
import { publish } from '../services/eventBus.js';
import { submitDecision } from '../services/approvalService.js';
import { buildReport, reportHtml } from '../services/reportService.js';
import { evidenceRepo } from '../database/repositories/evidence.js';
import { problemsRepo } from '../database/repositories/problems.js';

export const createIncidentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  scenarioKey: z.enum(['payments', 'authentication', 'orders', 'notifications']).optional(),
  service: z.string().max(80).optional(),
  environment: z.string().max(40).optional(),
  timeframe: z.string().max(40).optional(),
  evidence: z.array(z.object({
    filename: z.string().min(1).max(120),
    content: z.string().max(80000),
  })).max(3).optional(),
});

export function createIncident(body) {
  const scenario = body.scenarioKey ? buildScenario(body.scenarioKey) : null;
  const description = cleanText(body.description || scenario?.description || '', 2000);
  if (!description) throw httpError(400, 'validation_error', 'Description is required');
  const category = scenario?.category || classifyText(description) || 'custom';
  const title = cleanText(body.title || scenario?.title || description.slice(0, 80), 200);
  const incident = incidentsRepo.create({
    title,
    description,
    category,
    severity: scenario?.severity || 'medium',
    scenarioKey: scenario?.key || null,
    service: cleanText(body.service || '', 80) || null,
    environment: cleanText(body.environment || '', 40) || null,
    timeframe: cleanText(body.timeframe || '', 40) || null,
  });
  for (const file of body.evidence || []) {
    const filename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!/\.(txt|log|json|csv)$/i.test(filename)) continue;
    evidenceRepo.add(incident.id, { filename, content: file.content.slice(0, 80000) });
  }
  return incident;
}

export function listIncidents(query) {
  return incidentsRepo.list({
    status: query.status || undefined,
    severity: query.severity || undefined,
  });
}

export function getIncident(id) {
  const incident = incidentsRepo.get(id);
  if (!incident) throw httpError(404, 'not_found', 'Incident not found');
  const events = eventsRepo.list(id, 0);
  const planEvent = [...events].reverse().find((event) => event.type === 'plan_created');
  const runs = runsRepo.forIncident(id);
  return {
    incident,
    plan: planEvent?.payload?.plan || [],
    objective: planEvent?.payload?.objective || null,
    affectedServices: planEvent?.payload?.affectedServices || [],
    remediations: remediationsRepo.forIncident(id),
    verification: verificationsRepo.latest(id),
    run: runs[0] || null,
    report: reportsRepo.get(id),
    problems: problemsRepo.list(id),
    evidence: evidenceRepo.list(id).map((file) => ({ id: file.id, filename: file.filename, created_at: file.created_at })),
  };
}

export function runIncident(id, body) {
  return startRun(id, { pacing: body.pacing || env.DEMO_PACING, partialRecovery: Boolean(body.partialRecovery) });
}

export function runDemo(body) {
  const scenario = buildScenario('payments');
  const incident = incidentsRepo.create({
    title: scenario.title,
    description: scenario.description,
    category: scenario.category,
    severity: scenario.severity,
    scenarioKey: 'payments',
  });
  const run = startRun(incident.id, {
    pacing: body.pacing || env.DEMO_PACING,
    partialRecovery: Boolean(body.partialRecovery),
  });
  return run;
}

function decide(id, remediationId, decision, reason) {
  const incident = incidentsRepo.get(id);
  const row = remediationsRepo.get(remediationId);
  if (!incident || !row || row.incident_id !== incident.id) throw httpError(404, 'not_found', 'Remediation not found');
  if (decision === 'approved' && (row.status === 'approved' || row.status === 'executed')) {
    submitDecision(id, remediationId, { decision: 'approved' });
    return remediationsRepo.get(remediationId);
  }
  if (decision === 'rejected' && row.status === 'rejected') return row;
  if (row.status !== 'proposed') throw httpError(409, 'conflict', 'Remediation is not awaiting approval');
  const updated = remediationsRepo.mark(row.id, decision === 'approved' ? 'approved' : 'rejected');
  const run = runsRepo.activeForIncident(id);
  if (run) runsRepo.update(run.id, { status: 'running' });
  publish({
    incidentId: id,
    runId: row.run_id,
    type: decision === 'approved' ? 'approval_granted' : 'approval_rejected',
    stage: 'approval',
    agentRole: 'Remediation Agent',
    payload: {
      remediationId,
      reason: reason || null,
      message: decision === 'approved' ? 'Action authorized' : 'Action rejected',
    },
  });
  submitDecision(id, remediationId, { decision, reason });
  return updated;
}

export function approveIncident(id, remediationId) {
  return decide(id, remediationId, 'approved');
}

export function rejectIncident(id, remediationId, reason) {
  return decide(id, remediationId, 'rejected', reason);
}

export function scenarioList() {
  return listScenarios();
}

export function incidentReport(id, format) {
  const saved = reportsRepo.get(id) || (() => {
    const built = buildReport(id);
    return built ? { markdown: built.markdown, data: built.data } : null;
  })();
  if (!saved) throw httpError(404, 'not_found', 'Report not found');
  if (format === 'md') return { type: 'md', body: saved.markdown };
  if (format === 'html') return { type: 'html', body: reportHtml({ data: saved.data }) };
  return { type: 'json', body: saved.data };
}
