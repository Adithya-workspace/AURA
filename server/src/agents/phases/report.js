import { publish } from '../../services/eventBus.js';
import { incidentsRepo } from '../../database/repositories/incidents.js';
import { runsRepo } from '../../database/repositories/runs.js';
import { reportsRepo } from '../../database/repositories/reports.js';
import { buildReport } from '../../services/reportService.js';
import { executeTool } from '../../tools/registry.js';
import { dropWorld } from '../../simulation/world.js';

export async function reportPhase(ctx, outcome, reason) {
  await executeTool('generate_report', { incidentId: ctx.incident.id }, {
    world: ctx.world,
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    phase: 'report',
    pacing: ctx.world.pacing,
    why: 'Compile the incident record into a report.',
  });
  const now = Date.now();
  const status = outcome === 'resolved' ? 'resolved' : outcome === 'partially_resolved' ? 'partially_resolved' : 'escalated';
  incidentsRepo.update(ctx.incident.id, { status, resolved_at: now });
  runsRepo.update(ctx.run.id, { status: outcome === 'resolved' ? 'succeeded' : outcome === 'partially_resolved' ? 'partial' : 'failed', ended_at: now, attempts: ctx.executed });
  const report = buildReport(ctx.incident.id);
  reportsRepo.save(ctx.incident.id, report.markdown, report.data);
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: outcome === 'resolved' ? 'incident_resolved' : 'incident_escalated',
    stage: 'report',
    agentRole: 'Root Cause Analyst',
    payload: {
      reason: reason || null,
      status,
      report: report.data,
      markdown: report.markdown,
      message: outcome === 'resolved'
        ? 'Recovery confirmed and report filed'
        : outcome === 'partially_resolved'
          ? `Partially resolved${reason ? `: ${reason}` : ''}`
          : `Escalated to human${reason ? `: ${reason}` : ''}`,
    },
  });
  dropWorld(ctx.run.id);
}
