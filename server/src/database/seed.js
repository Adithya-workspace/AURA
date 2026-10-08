import { db } from './db.js';

const DAY = 24 * 60 * 60 * 1000;

export function seed() {
  const database = db();
  const user = database.get('SELECT id FROM users WHERE id = ?', ['seed-operator']);
  if (!user) {
    database.run('INSERT INTO users (id, name, role) VALUES (?, ?, ?)', ['seed-operator', 'Alex Rivera', 'on-call']);
  }

  const samples = [
    {
      id: 'seed-inc-payments',
      title: 'Card authorization timeouts',
      description: 'Historical payment incident resolved by raising the pool.',
      category: 'payments',
      severity: 'high',
      status: 'resolved',
      scenario_key: 'payments',
      age: 2 * 60 * 60 * 1000,
      resolved: true,
    },
    {
      id: 'seed-inc-auth',
      title: 'SSO token rejects',
      description: 'Historical authentication incident resolved by config rollback.',
      category: 'authentication',
      severity: 'high',
      status: 'resolved',
      scenario_key: 'authentication',
      age: 26 * 60 * 60 * 1000,
      resolved: true,
    },
    {
      id: 'seed-inc-orders',
      title: 'Fulfillment backlog',
      description: 'Historical order incident resolved by scaling workers.',
      category: 'orders',
      severity: 'medium',
      status: 'resolved',
      scenario_key: 'orders',
      age: 50 * 60 * 60 * 1000,
      resolved: true,
    },
    {
      id: 'seed-inc-notes',
      title: 'SMS provider outage',
      description: 'Historical notification incident escalated after a provider outage.',
      category: 'notifications',
      severity: 'medium',
      status: 'escalated',
      scenario_key: 'notifications',
      age: 5 * 60 * 60 * 1000,
      resolved: false,
    },
  ];

  const now = Date.now();
  for (const sample of samples) {
    const existing = database.get('SELECT id FROM incidents WHERE id = ?', [sample.id]);
    if (existing) continue;
    const created = now - sample.age;
    const resolvedAt = sample.resolved ? created + 12 * 60 * 1000 : null;
    database.run(
      `INSERT INTO incidents (id, title, description, category, severity, status, scenario_key, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sample.id, sample.title, sample.description, sample.category, sample.severity, sample.status, sample.scenario_key, created, resolvedAt],
    );
    const runId = `seed-run-${sample.id}`;
    database.run(
      `INSERT INTO agent_runs (id, incident_id, status, mode, llm_provider, started_at, ended_at, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [runId, sample.id, sample.resolved ? 'succeeded' : 'failed', 'seed', 'mock', created, resolvedAt || created + DAY / 24, 1],
    );
    const report = {
      title: sample.title,
      rootCause: sample.resolved ? 'Resolved by the on-call agent.' : 'Escalated to a human after insufficient recovery.',
      status: sample.status,
    };
    database.run(
      'INSERT INTO reports (incident_id, markdown, json, created_at) VALUES (?, ?, ?, ?)',
      [sample.id, `# ${sample.title}\n\n${report.rootCause}\n`, JSON.stringify(report), resolvedAt || created],
    );
  }
}

export function resetDemoData() {
  const database = db();
  database.run(`DELETE FROM reports WHERE incident_id NOT LIKE 'seed-%'`);
  database.run(`DELETE FROM verification_results WHERE incident_id NOT LIKE 'seed-%'`);
  database.run(`DELETE FROM remediation_actions WHERE incident_id NOT LIKE 'seed-%'`);
  database.run(`DELETE FROM tool_executions WHERE incident_id NOT LIKE 'seed-%'`);
  database.run(`DELETE FROM incident_events WHERE incident_id NOT LIKE 'seed-%'`);
  database.run(`DELETE FROM agent_runs WHERE incident_id NOT LIKE 'seed-%'`);
  database.run(`DELETE FROM incidents WHERE id NOT LIKE 'seed-%'`);
}

export function markOrphans() {
  const database = db();
  const now = Date.now();
  const stuck = database.all(
    `SELECT id, incident_id FROM agent_runs WHERE status IN ('running', 'awaiting_approval')`,
  );
  for (const run of stuck) {
    database.run(`UPDATE agent_runs SET status = 'interrupted', ended_at = ? WHERE id = ?`, [now, run.id]);
    database.run(
      `UPDATE incidents SET status = 'escalated', resolved_at = ? WHERE id = ? AND status NOT IN ('resolved', 'escalated')`,
      [now, run.incident_id],
    );
  }
  return stuck.length;
}
