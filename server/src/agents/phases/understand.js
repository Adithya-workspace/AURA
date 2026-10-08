import { generateStructured } from '../../llm/index.js';
import { understandSchema } from '../schemas.js';
import { SYSTEM_PROMPT, understandPrompt } from '../prompts/system.js';
import { toolCatalog } from '../../tools/registry.js';
import { incidentsRepo } from '../../database/repositories/incidents.js';
import { publish } from '../../services/eventBus.js';

export async function understandPhase(ctx) {
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'incident_received',
    stage: 'received',
    agentRole: 'Planner',
    payload: { title: ctx.incident.title, description: ctx.incident.description, message: 'Incident received' },
  });
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'understanding_started',
    stage: 'understand',
    agentRole: 'Planner',
    payload: { message: 'Reading the incident and drafting a plan' },
  });
  const decision = await generateStructured({
    system: SYSTEM_PROMPT,
    user: understandPrompt(ctx.incident, toolCatalog()),
    schema: understandSchema,
    schemaName: 'understand',
    context: { world: ctx.world, category: ctx.world.category },
  });
  ctx.category = decision.category;
  ctx.plan = decision.plan;
  ctx.objective = decision.objective;
  incidentsRepo.update(ctx.incident.id, {
    category: decision.category,
    severity: decision.severity,
    status: 'investigating',
  });
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'plan_created',
    stage: 'plan',
    agentRole: 'Planner',
    payload: {
      ...decision,
      message: `Plan ready with ${decision.plan.length} steps`,
    },
  });
  return decision;
}
