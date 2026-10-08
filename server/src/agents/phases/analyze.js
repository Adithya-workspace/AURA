import { generateStructured } from '../../llm/index.js';
import { analyzeSchema } from '../schemas.js';
import { SYSTEM_PROMPT, analyzePrompt } from '../prompts/system.js';
import { getTool } from '../../tools/registry.js';
import { publish } from '../../services/eventBus.js';
import { incidentsRepo } from '../../database/repositories/incidents.js';

export async function analyzePhase(ctx, schemaName = 'analyze') {
  const decision = await generateStructured({
    system: SYSTEM_PROMPT,
    user: analyzePrompt({
      incident: ctx.incident,
      toolResults: ctx.toolResults.map((item) => ({ tool: item.tool, summary: item.summary, status: item.status })),
      attempt: ctx.executed + 1,
      lastVerdict: ctx.lastVerdict,
    }),
    schema: analyzeSchema,
    schemaName,
    context: {
      world: ctx.world,
      category: ctx.category,
      toolResults: ctx.toolResults,
      executed: ctx.executed,
      lastVerdict: ctx.lastVerdict,
      alternativeUsed: ctx.alternativeUsed,
    },
  });
  decision.confidence = Math.max(0, Math.min(100, Math.round(decision.confidence)));
  if (decision.remediation) {
    const tool = getTool(decision.remediation.tool);
    const parsed = tool?.safety === 'write' ? tool.inputSchema.safeParse(decision.remediation.args) : { success: false };
    if (!tool || tool.safety !== 'write' || !parsed.success) {
      decision.remediation = null;
      decision.confidence = Math.min(decision.confidence, 40);
    } else {
      decision.remediation.args = parsed.data;
    }
  }
  if (schemaName === 'analyze') {
    incidentsRepo.update(ctx.incident.id, { status: 'root_cause_identified' });
    if (ctx.executed === 0 && ctx.world.fixes?.length) {
      publish({
        incidentId: ctx.incident.id,
        runId: ctx.run.id,
        type: 'remediation_plan',
        stage: 'approval',
        agentRole: 'Remediation Agent',
        payload: {
          plan: ctx.world.fixes.map((fix) => fix.proposal),
          message: `Remediation plan has ${ctx.world.fixes.length} steps`,
        },
      });
    }
    publish({
      incidentId: ctx.incident.id,
      runId: ctx.run.id,
      type: 'root_cause_identified',
      stage: 'analyze',
      agentRole: 'Root Cause Analyst',
      payload: {
        rootCause: decision.rootCause,
        confidence: decision.confidence,
        evidence: decision.evidence,
        ruledOut: decision.ruledOut,
        message: decision.rootCause,
      },
    });
  }
  ctx.analysis = decision;
  return decision;
}
