import { executeTool } from '../../tools/registry.js';
import { publish } from '../../services/eventBus.js';
import { incidentsRepo } from '../../database/repositories/incidents.js';
import { verificationsRepo } from '../../database/repositories/verifications.js';

export async function verifyPhase(ctx) {
  incidentsRepo.update(ctx.incident.id, { status: 'verifying' });
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'verification_started',
    stage: 'verify',
    agentRole: 'Verification Agent',
    payload: { message: 'Re-checking health, latency, and the key resource' },
  });
  const result = await executeTool('verify_recovery', { incidentId: ctx.incident.id }, {
    world: ctx.world,
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    phase: 'verify',
    pacing: ctx.world.pacing,
    why: 'Compare the live system with the pre-change snapshot.',
  });
  const verdict = result.data?.verdict || 'NOT_CONFIRMED';
  verificationsRepo.insert({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    before: result.data.before,
    after: result.data.after,
    verdict,
  });
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'verification_completed',
    stage: 'verify',
    agentRole: 'Verification Agent',
    payload: {
      before: result.data.before,
      after: result.data.after,
      verdict,
      deltas: result.data.deltas,
      message: `Verification ${verdict.replaceAll('_', ' ').toLowerCase()}`,
    },
  });
  ctx.lastVerdict = verdict;
  return verdict;
}
