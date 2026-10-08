import { executeTool } from '../../tools/registry.js';
import { liveSnapshot } from '../../simulation/metrics.js';
import { rampMs } from '../../simulation/pacing.js';
import { publish } from '../../services/eventBus.js';
import { incidentsRepo } from '../../database/repositories/incidents.js';
import { remediationsRepo } from '../../database/repositories/remediations.js';

export async function actPhase(ctx, remediation) {
  incidentsRepo.update(ctx.incident.id, { status: 'remediating' });
  ctx.world.verificationBefore = liveSnapshot(ctx.world);
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'action_started',
    stage: 'act',
    agentRole: 'Remediation Agent',
    payload: { remediationId: remediation.id, title: remediation.title, message: `Applying ${remediation.title}` },
  });
  const result = await executeTool('apply_remediation', remediation.args, {
    world: ctx.world,
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    phase: 'act',
    pacing: ctx.world.pacing,
    why: remediation.rationale,
  });
  const steps = result.data?.steps || ['Change requested'];
  for (let index = 0; index < steps.length; index += 1) {
    publish({
      incidentId: ctx.incident.id,
      runId: ctx.run.id,
      type: 'action_progress',
      stage: 'act',
      agentRole: 'Remediation Agent',
      payload: {
        step: steps[index],
        index,
        total: steps.length,
        metrics: liveSnapshot(ctx.world),
        message: steps[index],
      },
    });
  }
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'action_completed',
    stage: 'act',
    agentRole: 'Remediation Agent',
    payload: { remediationId: remediation.id, summary: result.summary, steps, message: result.summary || 'Change applied' },
  });
  remediationsRepo.mark(remediation.id, result.status === 'completed' ? 'executed' : 'failed');
  await new Promise((resolve) => setTimeout(resolve, rampMs(ctx.world.pacing) + 30));
  return result;
}
