import { describe, expect, it } from 'vitest';
import { createCustomWorld, openProblems } from '../src/simulation/customWorld.js';
import { applyWorldRemediation } from '../src/simulation/world.js';
import { fallbackDecision, nextInvestigation } from '../src/agents/policy/fallbackPolicy.js';
import { tool as correlate } from '../src/tools/correlateErrors.js';
import { initDb } from '../src/database/db.js';
import { incidentsRepo } from '../src/database/repositories/incidents.js';
import { startRun } from '../src/services/runService.js';
import { approveIncident } from '../src/controllers/incidentsController.js';
import { remediationsRepo } from '../src/database/repositories/remediations.js';
import { problemsRepo } from '../src/database/repositories/problems.js';

const JUDGE = 'Customers are experiencing payment failures, checkout is slow, and some notifications are delayed. Investigate the incident and resolve everything you can.';

describe('custom incidents', () => {
  it('accepts an unknown report without inventing a service check', () => {
    const world = createCustomWorld('The office printer is jammed and nobody can print.');
    expect(world.noTelemetry).toBe(true);
    expect(world.scenarioKey).toBeNull();
    const step = nextInvestigation({ category: 'custom', toolResults: [], noTelemetry: true });
    expect(step.action).toBe('finish_investigation');
    const decision = fallbackDecision('analyze', { world, category: world.category, toolResults: [], executed: 0 });
    expect(decision.remediation).toBeNull();
    expect(decision.rootCause).toMatch(/Insufficient telemetry/i);
  });

  it('says when time-series data is missing', () => {
    const result = correlate.execute({ signals: ['db_utilization'] }, { series: {}, narrative: {} });
    expect(result.summary).toBe('Insufficient time-series data for correlation.');
    expect(result.data.score).toBeNull();
  });

  it('discovers several problems and keeps downstream issues open after the first fix', () => {
    const world = createCustomWorld(JUDGE, { pacing: 'fast' });
    expect(world.scenarioKey).toBeNull();
    expect(world.domains).toEqual(expect.arrayContaining(['payments', 'checkout', 'notifications']));
    const open = openProblems(world).map((problem) => problem.title);
    expect(open).toEqual(expect.arrayContaining([
      'Database connection pool exhaustion',
      'Payment API degradation',
      'Checkout queue backlog',
      'Notification processing delay',
    ]));
    const names = [];
    const tools = [];
    for (let i = 0; i < 8; i += 1) {
      const decision = nextInvestigation({ category: 'custom', toolResults: tools, steps: world.investigationSteps });
      if (decision.action === 'finish_investigation') break;
      names.push(decision.tool);
      tools.push({
        tool: decision.tool,
        args: decision.args,
        status: 'completed',
        data: decision.tool === 'analyze_logs'
          ? { topErrors: [{ message: 'DB_TIMEOUT: pool', count: 302 }] }
          : { score: 0.9 },
        findings: [],
      });
    }
    expect(names).toEqual(expect.arrayContaining(['analyze_transactions', 'check_database', 'correlate_errors']));
    expect(names.filter((name) => name === 'check_queue').length).toBe(2);

    applyWorldRemediation(world, 'update_db_pool_size', { database: 'payments-db', size: 200 });
    const afterPrimary = openProblems(world).map((problem) => problem.id);
    expect(afterPrimary).not.toContain('prob-pool');
    expect(afterPrimary).toContain('prob-checkout');
    expect(afterPrimary).toContain('prob-notify');
    applyWorldRemediation(world, 'scale_workers', { queue: 'checkout-queue', workers: 6 });
    expect(openProblems(world)).toHaveLength(0);
    expect(world.queues['email-queue'].lagMs).toBeLessThan(5000);
  });

  it('resolves the multi-problem incident through approvals', async () => {
    await initDb();
    const incident = incidentsRepo.create({
      title: 'Checkout and payments',
      description: JUDGE,
      category: 'custom',
      severity: 'critical',
      scenarioKey: null,
    });
    startRun(incident.id, { pacing: 'fast' });
    const approved = new Set();
    let current = incident;
    for (let i = 0; i < 100 && !['resolved', 'partially_resolved', 'escalated'].includes(current.status); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      for (const row of remediationsRepo.forIncident(incident.id)) {
        if (row.status === 'proposed' && !approved.has(row.id)) {
          approved.add(row.id);
          approveIncident(incident.id, row.id);
        }
      }
      current = incidentsRepo.get(incident.id);
    }
    expect(current.status).toBe('resolved');
    const problems = problemsRepo.list(incident.id);
    expect(problems.filter((problem) => problem.type !== 'unrelated' && problem.status !== 'resolved')).toHaveLength(0);
    expect(approved.size).toBe(2);
  }, 20000);
});
