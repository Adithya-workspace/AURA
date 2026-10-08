import { tool as getServiceMetrics } from './getServiceMetrics.js';
import { tool as checkApiHealth } from './checkApiHealth.js';
import { tool as analyzeLogs } from './analyzeLogs.js';
import { tool as analyzeTransactions } from './analyzeTransactions.js';
import { tool as checkDatabase } from './checkDatabase.js';
import { tool as checkQueue } from './checkQueue.js';
import { tool as checkSecurityEvents } from './checkSecurityEvents.js';
import { tool as getRecentChanges } from './getRecentChanges.js';
import { tool as correlateErrors } from './correlateErrors.js';
import { tool as applyRemediation } from './applyRemediation.js';
import { tool as verifyRecovery } from './verifyRecovery.js';
import { tool as generateReport } from './generateReport.js';
import { tool as deleteRecords } from './deleteRecords.js';
import { simulatedLatency } from '../simulation/pacing.js';
import { toolExecutionsRepo } from '../database/repositories/toolExecutions.js';
import { approvalMatches } from '../services/approvalService.js';
import { remediationsRepo } from '../database/repositories/remediations.js';
import { publish } from '../services/eventBus.js';
import { newId } from '../utils/ids.js';

const tools = [
  getServiceMetrics,
  checkApiHealth,
  analyzeLogs,
  analyzeTransactions,
  checkDatabase,
  checkQueue,
  checkSecurityEvents,
  getRecentChanges,
  correlateErrors,
  applyRemediation,
  verifyRecovery,
  generateReport,
  deleteRecords,
];

const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

function inputHint(schema) {
  const shape = schema.shape || {};
  return Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, value._def?.typeName || 'value']));
}

export function toolCatalog() {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    safety: tool.safety,
    agentRole: tool.agentRole,
    appliesTo: tool.appliesTo,
    input: inputHint(tool.inputSchema),
  }));
}

export function getTool(name) {
  return byName[name] || null;
}

function emit(ctx, type, payload, agentRole) {
  if (!ctx?.incidentId) return;
  publish({
    incidentId: ctx.incidentId,
    runId: ctx.runId,
    type,
    stage: ctx.phase || null,
    agentRole: agentRole || null,
    payload,
  });
}

export async function executeTool(name, args, ctx = {}) {
  const tool = byName[name];
  const started = Date.now();
  if (!tool) {
    return { id: newId('tool'), status: 'failed', tool: name, error: 'Unknown tool', durationMs: 0 };
  }

  const parsed = tool.inputSchema.safeParse(args ?? {});
  if (!parsed.success) {
    const error = parsed.error.issues.map((issue) => issue.message).join('; ');
    const result = { status: 'failed', tool: name, error, durationMs: Date.now() - started, safety: tool.safety };
    record(ctx, tool, args, result);
    emit(ctx, 'tool_failed', { tool: name, error, why: ctx.why || '' }, tool.agentRole);
    return result;
  }

  if (tool.safety === 'destructive' || (ctx.phase === 'investigate' && tool.safety !== 'read')) {
    const reason = tool.safety === 'destructive'
      ? 'Destructive operations are disabled'
      : 'Only read tools are allowed during investigation';
    emit(ctx, 'safety_blocked', { tool: name, reason }, tool.agentRole);
    const result = { status: 'blocked', tool: name, error: reason, durationMs: 0, safety: tool.safety };
    record(ctx, tool, parsed.data, result);
    return result;
  }

  if (tool.phase && ctx.phase && tool.phase !== ctx.phase) {
    const reason = `${name} is only available in the ${tool.phase} phase`;
    emit(ctx, 'safety_blocked', { tool: name, reason }, tool.agentRole);
    const result = { status: 'blocked', tool: name, error: reason, durationMs: 0, safety: tool.safety };
    record(ctx, tool, parsed.data, result);
    return result;
  }

  if (tool.safety === 'write') {
    const rows = ctx.incidentId ? remediationsRepo.forIncident(ctx.incidentId) : [];
    const approved = rows.some((row) => approvalMatches(row, tool.name, parsed.data));
    if (!approved) {
      const reason = 'Write tools require a matching approved remediation';
      emit(ctx, 'safety_blocked', { tool: name, reason }, tool.agentRole);
      const result = { status: 'blocked', tool: name, error: reason, durationMs: 0, safety: tool.safety };
      record(ctx, tool, parsed.data, result);
      return result;
    }
  }

  emit(ctx, 'tool_started', { tool: name, args: parsed.data, why: ctx.why || '', safety: tool.safety }, tool.agentRole);
  await simulatedLatency(ctx.pacing);
  try {
    const output = tool.execute(parsed.data, ctx.world);
    const durationMs = Date.now() - started;
    emit(ctx, 'tool_completed', {
      tool: name,
      args: parsed.data,
      why: ctx.why || '',
      durationMs,
      summary: output.summary,
      findings: output.findings,
      data: output.data,
      safety: tool.safety,
    }, tool.agentRole);
    emit(ctx, 'finding_detected', { tool: name, findings: output.findings }, tool.agentRole);
    if (name === 'correlate_errors') {
      emit(ctx, 'correlation_completed', output.data, tool.agentRole);
    }
    const result = { status: 'completed', tool: name, args: parsed.data, durationMs, safety: tool.safety, ...output };
    record(ctx, tool, parsed.data, result);
    return result;
  } catch (error) {
    const durationMs = Date.now() - started;
    emit(ctx, 'tool_failed', { tool: name, error: error.message, why: ctx.why || '' }, tool.agentRole);
    const result = { status: 'failed', tool: name, error: error.message, durationMs, safety: tool.safety };
    record(ctx, tool, parsed.data, result);
    return result;
  }
}

function record(ctx, tool, args, result) {
  if (!ctx?.incidentId) return;
  toolExecutionsRepo.insert({
    runId: ctx.runId,
    incidentId: ctx.incidentId,
    tool: tool.name,
    args,
    status: result.status,
    durationMs: result.durationMs,
    result,
    safety: tool.safety,
    why: ctx.why || '',
  });
}
