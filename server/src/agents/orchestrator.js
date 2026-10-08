import { understandPhase } from './phases/understand.js';
import { investigatePhase } from './phases/investigate.js';
import { analyzePhase } from './phases/analyze.js';
import { actPhase } from './phases/act.js';
import { verifyPhase } from './phases/verify.js';
import { reportPhase } from './phases/report.js';
import { publish } from '../services/eventBus.js';
import { incidentsRepo } from '../database/repositories/incidents.js';
import { runsRepo } from '../database/repositories/runs.js';
import { remediationsRepo } from '../database/repositories/remediations.js';
import { hashRemediation, waitForDecision } from '../services/approvalService.js';
import { dropWorld } from '../simulation/world.js';
import { liveSnapshot } from '../simulation/metrics.js';
import { openProblems } from '../simulation/customWorld.js';
import { problemsRepo } from '../database/repositories/problems.js';
import { log } from '../utils/logger.js';

export async function runOrchestrator(ctx) {
  ctx.toolResults = [];
  ctx.executed = 0;
  ctx.alternativeUsed = false;
  ctx.lastVerdict = null;
  try {
    await understandPhase(ctx);
    await investigatePhase(ctx);
    rememberProblems(ctx);
    let outcome = 'escalated';
    let reason = 'Evidence was not strong enough to act';
    const maxAttempts = Math.min(4, Math.max(2, ctx.world.fixes?.length || 2));
    while (ctx.executed < maxAttempts) {
      const analysis = await analyzePhase(ctx, 'analyze');
      if (!analysis.remediation) break;
      const approved = await gate(ctx, analysis.remediation);
      if (!approved) {
        reason = 'Human rejected the proposed change';
        break;
      }
      await actPhase(ctx, approved);
      ctx.executed += 1;
      syncProblems(ctx);
      runsRepo.update(ctx.run.id, { attempts: ctx.executed, status: 'running' });
      const verdict = await verifyPhase(ctx);
      const remaining = openProblems(ctx.world);
      const live = liveSnapshot(ctx.world);
      const healthy = live.errorRate < 0.03 && live.resource < (live.resourceThreshold ?? 1);
      if (remaining.length === 0 && (verdict === 'CONFIRMED' || (healthy && verdict !== 'PARTIAL'))) {
        outcome = 'resolved';
        reason = null;
        break;
      }
      if (ctx.executed >= maxAttempts) {
        outcome = remaining.length ? 'partially_resolved' : 'escalated';
        reason = remaining.length
          ? `Primary path changed, but these problems remain: ${remaining.map((problem) => problem.title).join(', ')}`
          : 'Recovery was not confirmed after the safe attempt limit';
        break;
      }
      incidentsRepo.update(ctx.incident.id, { status: 'adapting' });
      publish({
        incidentId: ctx.incident.id,
        runId: ctx.run.id,
        type: 'adaptation_started',
        stage: 'adapt',
        agentRole: 'Verification Agent',
        payload: {
          reason: remaining.length
            ? `Primary cause improved, but ${remaining.length} problem${remaining.length === 1 ? '' : 's'} remain: ${remaining.map((problem) => problem.title).join(', ')}`
            : `Verification returned ${verdict}`,
          remaining: remaining.map((problem) => problem.title),
          attempt: ctx.executed + 1,
          message: remaining.length ? 'Adapting to the problems that are still open' : `Adapting after ${verdict}`,
        },
      });
    }
    await reportPhase(ctx, outcome, reason);
  } catch (error) {
    log('error', 'run failed', { message: error.message, incidentId: ctx.incident.id });
    publish({
      incidentId: ctx.incident.id,
      runId: ctx.run.id,
      type: 'run_failed',
      stage: 'failed',
      agentRole: 'Planner',
      payload: { message: error.message || 'The run failed' },
    });
    incidentsRepo.update(ctx.incident.id, { status: 'escalated', resolved_at: Date.now() });
    runsRepo.update(ctx.run.id, { status: 'failed', ended_at: Date.now() });
    dropWorld(ctx.run.id);
  }
}

async function gate(ctx, proposal) {
  let current = propose(ctx, proposal);
  let decision = await waitForDecision(ctx.incident.id, current.id);
  if (decision.decision === 'approved') return current;
  const alternative = await analyzePhase(ctx, 'alternative');
  ctx.alternativeUsed = true;
  if (!alternative.remediation) return null;
  current = propose(ctx, alternative.remediation);
  decision = await waitForDecision(ctx.incident.id, current.id);
  return decision.decision === 'approved' ? current : null;
}

function propose(ctx, proposal) {
  const args = proposal.args;
  const record = remediationsRepo.create({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    tool: proposal.tool,
    args,
    argsHash: hashRemediation(proposal.tool, args),
    title: proposal.title,
    rationale: proposal.rationale,
    risk: proposal.risk,
  });
  incidentsRepo.update(ctx.incident.id, { status: 'awaiting_approval' });
  runsRepo.update(ctx.run.id, { status: 'awaiting_approval' });
  const change = changeLabel(args);
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'remediation_proposed',
    stage: 'approval',
    agentRole: 'Remediation Agent',
    payload: { remediationId: record.id, ...proposal, change, message: proposal.title },
  });
  publish({
    incidentId: ctx.incident.id,
    runId: ctx.run.id,
    type: 'approval_required',
    stage: 'approval',
    agentRole: 'Remediation Agent',
    payload: {
      remediationId: record.id,
      title: proposal.title,
      change,
      rationale: proposal.rationale,
      expectedImpact: proposal.expectedImpact,
      risk: proposal.risk,
      tool: proposal.tool,
      args,
      message: `Approval required: ${proposal.title}`,
    },
  });
  return { ...proposal, id: record.id, args };
}

function rememberProblems(ctx) {
  const problems = ctx.world.problems || [];
  if (!problems.length) return;
  problemsRepo.replace(ctx.incident.id, problems);
  incidentsRepo.update(ctx.incident.id, { status: 'problems_discovered' });
  for (const problem of problems) {
    publish({
      incidentId: ctx.incident.id,
      runId: ctx.run.id,
      type: 'problem_discovered',
      stage: 'discover',
      agentRole: 'Root Cause Analyst',
      payload: { ...problem, message: problem.title },
    });
  }
}

function syncProblems(ctx) {
  if (!ctx.world.problems?.length) return;
  problemsRepo.replace(ctx.incident.id, ctx.world.problems);
  for (const problem of ctx.world.problems) {
    publish({
      incidentId: ctx.incident.id,
      runId: ctx.run.id,
      type: 'problem_updated',
      stage: 'verify',
      agentRole: 'Verification Agent',
      payload: { id: problem.id, status: problem.status, title: problem.title, type: problem.type, message: `${problem.title} is ${problem.status}` },
    });
  }
}

function changeLabel(args) {
  const params = args?.params || {};
  if (args?.action === 'update_db_pool_size') return `100 → ${params.size}`;
  if (args?.action === 'scale_workers') return `workers → ${params.workers}`;
  if (args?.action === 'switch_provider') return `provider → ${params.provider}`;
  if (args?.action === 'restart_service') return `restart ${params.service}`;
  if (args?.action === 'rollback_config') return `rollback ${params.changeId}`;
  if (args?.action === 'update_rate_limit') return `rate limit → ${params.limit}`;
  return args?.action || 'change';
}
