import { describe, expect, it } from 'vitest';
import { assessEvidence } from '../src/agents/policy/evidence.js';
import { fallbackDecision, nextInvestigation } from '../src/agents/policy/fallbackPolicy.js';
import { classifyText } from '../src/simulation/scenarios/index.js';
import { createWorld } from '../src/simulation/world.js';

function completed(tool, data = {}) {
  return {
    tool,
    status: 'completed',
    data,
    findings: [{ label: 'signal', value: 'present', severity: 'critical' }],
  };
}

function sample(tool, category) {
  if (tool === 'correlate_errors') return { score: 0.93, linkage: 'db_utilization', base: 'error_rate', failureSharePct: 87 };
  if (tool === 'check_database') return { utilization: 0.98, active: 98, max: 100, timeouts: 302 };
  if (tool === 'analyze_transactions') return { failureRate: 0.184, byReason: { DB_TIMEOUT: 302 } };
  if (tool === 'get_service_metrics') return { errorRate: 0.184, p95Ms: 4800 };
  if (tool === 'get_recent_changes') return { changes: [{ redHerring: true, title: 'v2.4.1 dependency bump' }] };
  if (tool === 'check_security_events') return { keyMismatch: true, tokenErrors: 388 };
  if (tool === 'check_queue') return { depth: 1480, consumers: 2, lagMs: 240000 };
  if (tool === 'analyze_logs' && (category === 'payments' || category === 'unknown')) {
    return { errorCount: 347, eventCount: 12482, topErrors: [{ message: 'DB_TIMEOUT: pool', count: 302 }] };
  }
  if (tool === 'analyze_logs' && category === 'notifications') {
    return { errorCount: 20, eventCount: 100, topErrors: [{ message: 'PROVIDER_RATE_LIMIT circuit=open', count: 12 }] };
  }
  if (tool === 'analyze_logs' && category === 'orders') {
    return { errorCount: 20, eventCount: 100, topErrors: [{ message: 'QUEUE_LAG orders-queue', count: 12 }] };
  }
  return { errorCount: 20, eventCount: 100, topErrors: [{ message: 'JWT_INVALID_SIGNATURE', count: 12 }] };
}

function walk(category) {
  const tools = [];
  const calls = [];
  for (let i = 0; i < 8; i += 1) {
    const decision = nextInvestigation({ category, toolResults: tools });
    calls.push(decision);
    if (decision.action === 'finish_investigation') break;
    tools.push(completed(decision.tool, sample(decision.tool, category)));
  }
  return { tools, calls };
}

describe('investigation does not stop on weak evidence', () => {
  const early = [
    completed('get_service_metrics', { errorRate: 0.184, p95Ms: 4800 }),
    completed('check_api_health', { status: 'DEGRADED' }),
    completed('get_recent_changes', { changes: [{ redHerring: true, title: 'v2.4.1' }] }),
  ];

  it('rejects a finish after only metrics, health, and a deploy', () => {
    expect(assessEvidence(early, 'payments').sufficient).toBe(false);
    expect(assessEvidence(early, 'unknown').sufficient).toBe(false);
    expect(nextInvestigation({ category: 'payments', toolResults: early }).action).toBe('call_tool');
    expect(nextInvestigation({ category: 'unknown', toolResults: early }).tool).toBe('analyze_logs');
  });

  it('does not force a bare deploy report into the payment scenario', () => {
    expect(classifyText('A deployment just went out. Find out if it caused this.')).toBe('deployment');
    expect(classifyText('auth deployment broke login')).toBe('authentication');
    expect(classifyText('inventory service is returning intermittent 500 errors')).toBe('inventory');
  });

  it('covers logs, transactions, the database, and correlation for payments within 8 steps', () => {
    const { tools, calls } = walk('payments');
    const names = tools.map((item) => item.tool);
    expect(calls.length).toBeLessThanOrEqual(8);
    expect(names).toEqual(expect.arrayContaining(['analyze_logs', 'analyze_transactions', 'check_database', 'correlate_errors', 'get_recent_changes']));
    expect(names).not.toContain('apply_remediation');
    expect(names).not.toContain('delete_records');
    expect(calls.at(-1).action).toBe('finish_investigation');
  });

  it('selects different tools per category and never a write during investigation', () => {
    const categories = ['payments', 'authentication', 'orders', 'notifications'];
    const first = categories.map((category) => nextInvestigation({ category, toolResults: [] }).tool);
    expect(new Set(first).size).toBeGreaterThan(2);
    for (const category of [...categories, 'unknown']) {
      const { calls } = walk(category);
      expect(calls.length).toBeLessThanOrEqual(8);
      for (const call of calls) {
        expect(call.tool).not.toBe('apply_remediation');
        expect(call.tool).not.toBe('delete_records');
      }
    }
  });

  it('scores a corroborated pool exhaustion above 90 and leaves a weak report low', () => {
    const world = createWorld('payments', { pacing: 'fast' });
    const strong = fallbackDecision('analyze', {
      world,
      category: 'payments',
      executed: 0,
      toolResults: [
        completed('analyze_logs', sample('analyze_logs', 'payments')),
        completed('analyze_transactions', sample('analyze_transactions')),
        completed('check_database', sample('check_database')),
        completed('get_service_metrics', sample('get_service_metrics')),
        completed('get_recent_changes', sample('get_recent_changes')),
        completed('correlate_errors', sample('correlate_errors')),
      ],
    });
    expect(strong.confidence).toBeGreaterThanOrEqual(90);
    expect(strong.confidence).toBeLessThanOrEqual(95);
    expect(strong.rootCause).toMatch(/pool/i);
    expect(strong.evidence.length).toBeGreaterThanOrEqual(4);
    expect(strong.remediation.tool).toBe('apply_remediation');
    expect(strong.ruledOut.some((item) => /deploy/i.test(item.hypothesis))).toBe(true);

    const weak = fallbackDecision('analyze', { world, category: 'payments', executed: 0, toolResults: early });
    expect(weak.remediation).toBeNull();
    expect(weak.confidence).toBeLessThan(50);
  });
});
