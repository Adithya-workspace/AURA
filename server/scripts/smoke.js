import fs from 'fs';
import os from 'os';
import path from 'path';

const dbPath = path.join(os.tmpdir(), `aura-smoke-${process.pid}.sqlite`);
for (const file of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}
process.env.AURA_DB_PATH = dbPath;
process.env.AI_PROVIDER = 'mock';
process.env.DEMO_PACING = 'fast';
process.env.NODE_ENV = 'test';
process.env.PORT = '8791';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const { start } = await import('../src/index.js');
const { executeTool } = await import('../src/tools/registry.js');
const { createWorld } = await import('../src/simulation/world.js');

const base = `http://127.0.0.1:${process.env.PORT}`;
const server = await start();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function collect(incidentId, { partial = false } = {}) {
  const events = [];
  let after = 0;
  const started = Date.now();
  while (Date.now() - started < 90000) {
    const response = await fetch(`${base}/api/incidents/${incidentId}/events?after=${after}`);
    const body = await response.json();
    for (const event of body.events || []) {
      events.push(event);
      after = event.seq;
      if (event.type === 'approval_required') {
        const approved = await fetch(`${base}/api/incidents/${incidentId}/approve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ remediationId: event.payload.remediationId }),
        });
        if (!approved.ok) throw new Error(`approve failed ${approved.status}`);
      }
    }
    if (events.some((event) => event.type === 'incident_resolved' || event.type === 'incident_escalated' || event.type === 'run_failed')) {
      return events;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`timed out after ${events.map((event) => event.type).join(',')}`);
}

async function runScenario(key, { partial = false } = {}) {
  const response = await fetch(`${base}/api/incidents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenarioKey: key }),
  });
  const created = await response.json();
  assert(response.status === 201, `create ${key} failed`);
  const run = await fetch(`${base}/api/incidents/${created.incident.id}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pacing: 'fast', partialRecovery: partial }),
  });
  assert(run.status === 202, `run ${key} failed ${run.status}`);
  const events = await collect(created.incident.id, { partial });
  return { incidentId: created.incident.id, events };
}

function tools(events) {
  return [...new Set(events.filter((event) => event.type === 'tool_completed').map((event) => event.payload.tool))];
}

try {
  const payment = await runScenario('payments');
  const names = payment.events.map((event) => event.type);
  assert(names.includes('plan_created'), 'missing plan');
  assert(tools(payment.events).length >= 4, 'expected at least 4 tools');
  const root = payment.events.find((event) => event.type === 'root_cause_identified');
  assert(root && root.payload.confidence >= 80, 'confidence too low');
  const approvalAt = names.indexOf('approval_required');
  const actionAt = names.indexOf('action_started');
  assert(approvalAt >= 0 && approvalAt < actionAt, 'action started before approval');
  const writeBefore = payment.events.find((event) => event.type === 'tool_completed' && event.payload.tool === 'apply_remediation' && event.seq < payment.events[approvalAt].seq);
  assert(!writeBefore, 'write tool ran before approval');
  const verification = [...payment.events].reverse().find((event) => event.type === 'verification_completed');
  assert(verification?.payload?.verdict === 'CONFIRMED', `verdict ${verification?.payload?.verdict}`);
  assert(names.includes('incident_resolved'), 'not resolved');
  const report = await fetch(`${base}/api/incidents/${payment.incidentId}/report?format=md`);
  assert(report.ok && (await report.text()).includes('Root cause'), 'report missing');

  const world = createWorld('payments', { pacing: 'fast' });
  const blocked = await executeTool('delete_records', { table: 'charges' }, {
    world,
    incidentId: payment.incidentId,
    phase: 'act',
    pacing: 'fast',
  });
  assert(blocked.status === 'blocked', 'delete_records was not blocked');

  const partial = await runScenario('payments', { partial: true });
  const approvals = partial.events.filter((event) => event.type === 'approval_required');
  assert(partial.events.some((event) => event.type === 'adaptation_started'), 'missing adaptation');
  assert(approvals.length >= 2, 'expected a second approval');

  const auth = await runScenario('authentication');
  const orders = await runScenario('orders');
  const notes = await runScenario('notifications');
  const sets = [tools(payment.events), tools(auth.events), tools(orders.events), tools(notes.events)];
  assert(sets[1].includes('check_security_events'), 'auth tools');
  assert(!sets[1].includes('analyze_transactions'), 'auth should not analyze transactions');
  assert(sets[2].includes('check_queue') && !sets[2].includes('check_security_events'), 'order tools');
  assert(sets[3].includes('check_queue') && !sets[3].includes('analyze_transactions'), 'notification tools');
  assert(sets[0].includes('check_database') && sets[0].includes('analyze_transactions'), 'payment tools');
  const signatures = new Set(sets.map((items) => items.slice().sort().join('|')));
  assert(signatures.size === 4, `tool sets not distinct: ${[...signatures].join(' || ')}`);

  console.log('smoke passed');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.close(() => process.exit(process.exitCode || 0));
}
