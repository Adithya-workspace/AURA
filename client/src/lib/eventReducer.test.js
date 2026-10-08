import { describe, expect, it } from 'vitest';
import { reduceEvents } from './eventReducer.js';

const event = (seq, type, payload = {}, extra = {}) => ({
  id: `e${seq}`,
  seq,
  type,
  ts: 1_700_000_000_000 + seq * 1000,
  stage: extra.stage || null,
  agentRole: extra.agentRole || 'Planner',
  payload,
});

describe('event reducer', () => {
  it('rebuilds the workspace from replayed events', () => {
    const view = reduceEvents([
      event(1, 'incident_received', { message: 'Incident received' }),
      event(2, 'plan_created', { plan: [{ id: 'p1', title: 'Read logs', toolHint: 'analyze_logs' }], objective: 'Restore payments', affectedServices: ['payment-service'], category: 'payments', severity: 'critical' }, { stage: 'plan' }),
      event(3, 'tool_started', { tool: 'analyze_logs', why: 'Look at errors' }, { agentRole: 'Log Analyst' }),
      event(4, 'tool_completed', { tool: 'analyze_logs', durationMs: 40, summary: '347 errors', findings: [{ label: 'Errors', value: '347', severity: 'critical' }] }),
      event(5, 'root_cause_identified', { rootCause: 'Pool exhaustion', confidence: 94, evidence: [{ signal: 'Pool', detail: '98/100', weight: 0.4 }], ruledOut: [] }),
      event(6, 'approval_required', { remediationId: 'rem_1', title: 'Raise pool', change: '100 → 200', risk: 'medium' }),
      event(7, 'verification_completed', { verdict: 'CONFIRMED', before: { errorRate: 0.184, latencyMs: 4800, resource: 0.98 }, after: { errorRate: 0.012, latencyMs: 620, resource: 0.61 } }),
      event(8, 'incident_resolved', { report: { rootCause: 'Pool exhaustion' }, markdown: '# report' }),
    ]);
    expect(view.plan[0].done).toBe(true);
    expect(view.tools[0].status).toBe('completed');
    expect(view.confidence).toBe(94);
    expect(view.approval.state).toBe('pending');
    expect(view.verification.verdict).toBe('CONFIRMED');
    expect(view.status).toBe('resolved');
    expect(view.stages.find((stage) => stage.id === 'report').status).toBe('done');
  });

  it('inserts an adapting stage', () => {
    const view = reduceEvents([
      event(1, 'adaptation_started', { reason: 'PARTIAL' }),
    ]);
    expect(view.stages.some((stage) => stage.id === 'adapt' && stage.status === 'adapting')).toBe(true);
  });
});
