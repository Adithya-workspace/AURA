import { db } from '../db.js';
import { newId } from '../../utils/ids.js';

export const eventsRepo = {
  append({ incidentId, runId, type, stage, agentRole, payload }) {
    const current = db().get('SELECT COALESCE(MAX(seq), 0) AS seq FROM incident_events WHERE incident_id = ?', [incidentId]);
    const seq = Number(current?.seq || 0) + 1;
    const id = newId('evt');
    const ts = Date.now();
    db().run(
      `INSERT INTO incident_events (id, incident_id, run_id, seq, type, stage, agent_role, payload_json, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, incidentId, runId || null, seq, type, stage || null, agentRole || null, JSON.stringify(payload || {}), ts],
    );
    return {
      id,
      seq,
      incidentId,
      runId: runId || null,
      type,
      stage: stage || null,
      agentRole: agentRole || null,
      ts,
      payload: payload || {},
    };
  },
  list(incidentId, after = 0) {
    const rows = db().all(
      'SELECT * FROM incident_events WHERE incident_id = ? AND seq > ? ORDER BY seq ASC',
      [incidentId, after],
    );
    return rows.map(hydrate);
  },
  latestSeq(incidentId) {
    const row = db().get('SELECT COALESCE(MAX(seq), 0) AS seq FROM incident_events WHERE incident_id = ?', [incidentId]);
    return Number(row?.seq || 0);
  },
};

function hydrate(row) {
  return {
    id: row.id,
    seq: row.seq,
    incidentId: row.incident_id,
    runId: row.run_id,
    type: row.type,
    stage: row.stage,
    agentRole: row.agent_role,
    ts: row.ts,
    payload: JSON.parse(row.payload_json || '{}'),
  };
}
