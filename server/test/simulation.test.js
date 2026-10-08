import { describe, expect, it } from 'vitest';
import { pearson } from '../src/simulation/timeseries.js';
import { createWorld } from '../src/simulation/world.js';
import { judgeVerdict } from '../src/simulation/metrics.js';
import { nextInvestigation } from '../src/agents/policy/fallbackPolicy.js';

describe('correlation and verdicts', () => {
  it('ties payment errors to database utilization more than the CPU decoy', () => {
    const world = createWorld('payments', { pacing: 'fast' });
    const db = pearson(world.series.error_rate, world.series.db_utilization);
    const cpu = Math.abs(pearson(world.series.error_rate, world.series.checkout_cpu));
    expect(db).toBeGreaterThan(0.8);
    expect(db).toBeGreaterThan(cpu);
  });

  it('classifies recovery thresholds', () => {
    const before = { errorRate: 0.184, latencyMs: 4800, resource: 0.98, resourceThreshold: 0.75 };
    expect(judgeVerdict(before, { errorRate: 0.012, latencyMs: 620, resource: 0.61, resourceThreshold: 0.75 })).toBe('CONFIRMED');
    expect(judgeVerdict(before, { errorRate: 0.07, latencyMs: 2100, resource: 0.78, resourceThreshold: 0.75 })).toBe('PARTIAL');
    expect(judgeVerdict(before, { errorRate: 0.18, latencyMs: 4700, resource: 0.97, resourceThreshold: 0.75 })).toBe('NOT_CONFIRMED');
  });

  it('picks different tools per category', () => {
    const categories = ['payments', 'authentication', 'orders', 'notifications'];
    const first = categories.map((category) => nextInvestigation({ category, toolResults: [] }).tool);
    expect(new Set(first).size).toBeGreaterThan(2);
    expect(first[1]).toBe('check_security_events');
    expect(first[0]).toBe('analyze_logs');
    expect(first[2]).toBe('check_queue');
  });
});
