import { generateStructured } from '../../llm/index.js';
import { investigateSchema } from '../schemas.js';
import { SYSTEM_PROMPT, investigatePrompt } from '../prompts/system.js';
import { executeTool, toolCatalog } from '../../tools/registry.js';
import { assessEvidence, INSUFFICIENT_NOTE } from '../policy/evidence.js';
import { nextInvestigation } from '../policy/fallbackPolicy.js';
import { log } from '../../utils/logger.js';

const MAX_INVESTIGATION_STEPS = 8;

export async function investigatePhase(ctx) {
  let note = '';
  const category = () => ctx.category || ctx.world?.category || 'unknown';
  for (let i = 0; i < MAX_INVESTIGATION_STEPS; i += 1) {
    const decision = await generateStructured({
      system: SYSTEM_PROMPT,
      user: investigatePrompt({
        incident: ctx.incident,
        plan: ctx.plan,
        catalog: toolCatalog().filter((tool) => tool.safety === 'read' && tool.name !== 'verify_recovery' && tool.name !== 'generate_report'),
        toolResults: compact(ctx.toolResults),
        note,
      }),
      schema: investigateSchema,
      schemaName: 'investigate_step',
      context: { world: ctx.world, category: category(), toolResults: ctx.toolResults },
    });
    if (decision.action === 'finish_investigation') {
      const assessment = assessEvidence(ctx.toolResults, category(), { domains: ctx.world?.domains || [] });
      const another = nextInvestigation({
        category: category(),
        toolResults: ctx.toolResults,
        steps: ctx.world?.investigationSteps || null,
        noTelemetry: Boolean(ctx.world?.noTelemetry),
      });
      const moreWork = another.action === 'call_tool' && i < MAX_INVESTIGATION_STEPS - 1
        && (!assessment.sufficient || ctx.world?.coverSteps);
      if (moreWork) {
        note = assessment.sufficient
          ? 'Another affected service still has not been checked. Continue investigation using another relevant read-only tool.'
          : INSUFFICIENT_NOTE;
        log('info', 'continuing investigation', { incidentId: ctx.incident.id, missing: assessment.missing });
        continue;
      }
      break;
    }
    const result = await executeTool(decision.tool, decision.args || {}, {
      world: ctx.world,
      incidentId: ctx.incident.id,
      runId: ctx.run.id,
      phase: 'investigate',
      pacing: ctx.world.pacing,
      why: decision.why,
    });
    ctx.toolResults.push(result);
    if (result.status === 'blocked' || result.status === 'failed') {
      note = `${decision.tool} was ${result.status}: ${result.error}. Choose a different read tool.`;
    } else {
      note = '';
    }
  }
}

function compact(results) {
  return results.map((result) => ({
    tool: result.tool,
    status: result.status,
    summary: result.summary,
    findings: result.findings?.slice(0, 3) || [],
  }));
}
