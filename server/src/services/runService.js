import { incidentsRepo } from '../database/repositories/incidents.js';
import { runsRepo } from '../database/repositories/runs.js';
import { attachWorld, createWorld } from '../simulation/world.js';
import { createCustomWorld } from '../simulation/customWorld.js';
import { evidenceRepo } from '../database/repositories/evidence.js';
import { runOrchestrator } from '../agents/orchestrator.js';
import { env } from '../config/env.js';
import { httpError } from '../utils/http.js';
import { pacingOf } from '../simulation/pacing.js';

const BUSY = new Set(['investigating', 'problems_discovered', 'root_cause_identified', 'awaiting_approval', 'remediating', 'verifying', 'adapting']);

export function startRun(incidentId, options = {}) {
  const incident = incidentsRepo.get(incidentId);
  if (!incident) throw httpError(404, 'not_found', 'Incident not found');
  if (BUSY.has(incident.status) || runsRepo.activeForIncident(incidentId)) {
    throw httpError(409, 'already_running', 'An agent run is already in progress');
  }
  const pacing = pacingOf(options.pacing || env.DEMO_PACING);
  const world = incident.scenario_key
    ? createWorld(incident.scenario_key, { partialRecovery: Boolean(options.partialRecovery), pacing })
    : createCustomWorld(incident.description, {
      pacing,
      service: incident.service || '',
    });
  if (!incident.scenario_key) {
    world.uploads = evidenceRepo.list(incidentId).map((row) => ({ filename: row.filename, content: row.content }));
    if (world.uploads.length) {
      const step = {
        tool: 'analyze_logs',
        args: { service: 'uploaded-evidence', timeframe: '30m' },
        why: 'Read the files the operator attached. They are evidence, not live telemetry.',
      };
      world.investigationSteps = [step, ...(world.investigationSteps || [])].slice(0, 8);
      world.noTelemetry = false;
      world.coverSteps = true;
    }
  }
  const run = runsRepo.create({
    incidentId,
    mode: options.partialRecovery ? 'partial' : 'standard',
    provider: env.AI_PROVIDER,
  });
  attachWorld(run.id, world);
  incidentsRepo.update(incidentId, { status: 'investigating' });
  const fresh = incidentsRepo.get(incidentId);
  setImmediate(() => {
    runOrchestrator({ incident: fresh, run, world }).catch(() => {});
  });
  return { incidentId, runId: run.id };
}
