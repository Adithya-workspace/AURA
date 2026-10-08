import { buildScenario } from './scenarios/index.js';
import { liveSnapshot } from './metrics.js';

const worlds = new Map();

export function createWorld(scenarioKey, { partialRecovery = false, pacing = 'normal', now = Date.now() } = {}) {
  const scenario = buildScenario(scenarioKey || 'payments', now);
  if (!scenario) {
    const error = new Error(`Unknown scenario ${scenarioKey}`);
    error.code = 'unknown_scenario';
    throw error;
  }
  return {
    scenarioKey: scenario.key,
    pacing,
    partialRecovery: Boolean(partialRecovery),
    services: structuredClone(scenario.services),
    databases: structuredClone(scenario.databases),
    queues: structuredClone(scenario.queues),
    logs: structuredClone(scenario.logs),
    transactions: scenario.transactions ? structuredClone(scenario.transactions) : null,
    security: structuredClone(scenario.security),
    changes: structuredClone(scenario.changes),
    series: structuredClone(scenario.series),
    narrative: structuredClone(scenario.narrative),
    plan: structuredClone(scenario.plan),
    title: scenario.title,
    description: scenario.description,
    category: scenario.category,
    severity: scenario.severity,
    objective: scenario.objective,
    affectedServices: [...scenario.affectedServices],
    provider: scenario.narrative.primaryFix?.args?.params?.provider || null,
    clock: { ramp: null, applied: [] },
    verificationBefore: null,
  };
}

export function attachWorld(runId, world) {
  worlds.set(runId, world);
}

export function getWorld(runId) {
  return worlds.get(runId) || null;
}

export function dropWorld(runId) {
  worlds.delete(runId);
}

function paramsMatch(expected, actual) {
  return Object.entries(expected || {}).every(([key, value]) => actual?.[key] === value);
}

function markProblems(world, ids) {
  if (!world.problems || !ids) return;
  for (const problem of world.problems) {
    if (ids.includes(problem.id)) problem.status = 'resolved';
  }
}

export function applyWorldRemediation(world, action, params) {
  if (Array.isArray(world.fixes) && world.fixes.length) {
    const match = world.fixes.find((fix) => !fix.applied && fix.proposal?.args?.action === action && paramsMatch(fix.proposal.args.params, params));
    if (match) {
      match.applied = true;
      if (action === 'update_db_pool_size' && world.databases[params.database]) world.databases[params.database].max = params.size;
      if (action === 'scale_workers' && world.queues[params.queue]) world.queues[params.queue].consumers = params.workers;
      if (match.effect === 'clear-downstream') {
        for (const name of ['checkout-queue', 'email-queue']) {
          if (!world.queues[name]) continue;
          world.queues[name].depth = 12;
          world.queues[name].lagMs = 800;
          world.queues[name].oldestAgeSec = 6;
        }
      }
      const from = liveSnapshot(world);
      const target = world.narrative.full;
      world.clock.ramp = { startedAt: Date.now(), from, target: { ...from, ...target } };
      world.clock.applied.push({ action, params, strength: 'full', at: Date.now() });
      markProblems(world, match.problemIds);
      return { strength: 'full', steps: [`Validated ${action}`, `Applied ${action}`, 'Observed the affected path begin to settle'], summary: `Applied ${action}` };
    }
  }
  const primary = world.narrative.primaryFix;
  const second = world.narrative.secondFix;
  if (!primary) {
    return { strength: 'none', steps: ['No matching remediation for this world'], summary: 'No matching remediation' };
  }
  const matchesPrimary = primary.args.action === action && paramsMatch(primary.args.params, params);
  const matchesSecond = Boolean(second) && second.args.action === action && paramsMatch(second.args.params, params);
  const priorFix = world.clock.applied.some((item) => item.strength === 'partial' || item.strength === 'full');
  let strength = 'none';
  if (matchesSecond && priorFix) strength = 'full';
  else if (matchesPrimary) strength = world.partialRecovery && !priorFix ? 'partial' : 'full';
  else if (matchesSecond && !priorFix) strength = 'partial';

  const from = liveSnapshot(world);
  const target = strength === 'full'
    ? world.narrative.full
    : strength === 'partial'
      ? world.narrative.partial
      : {
        errorRate: Math.max(from.errorRate * 0.92, world.narrative.full.errorRate),
        latencyMs: Math.max(from.latencyMs * 0.9, world.narrative.full.latencyMs),
        resource: from.resource * 0.95,
      };

  if (action === 'update_db_pool_size' && world.databases[params.database]) {
    world.databases[params.database].max = params.size;
  }
  if (action === 'scale_workers' && world.queues[params.queue]) {
    world.queues[params.queue].consumers = params.workers;
  }
  if (action === 'switch_provider') {
    world.provider = params.provider;
  }
  if (action === 'restart_service') {
    const dbName = world.narrative.primaryDatabase;
    if (world.databases[dbName]) world.databases[dbName].timeouts = 0;
  }

  world.clock.ramp = { startedAt: Date.now(), from, target: { ...from, ...target } };
  world.clock.applied.push({ action, params, strength, at: Date.now() });
  if (strength === 'full' && !world.fixes?.length) markProblems(world, (world.problems || []).map((problem) => problem.id));

  const steps = [
    `Validated ${action}`,
    strength === 'none' ? 'Change applied with little effect on the fault' : `Applied ${action}`,
    'Observed the service begin to settle',
  ];
  return { strength, steps, summary: steps[1] };
}
