import { db } from '../db.js';
import { newId } from '../../utils/ids.js';

export const toolExecutionsRepo = {
  insert(input) {
    const id = newId('tool');
    db().run(
      `INSERT INTO tool_executions (id, run_id, incident_id, tool, args_json, status, duration_ms, result_json, safety, why, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.runId || null,
        input.incidentId || null,
        input.tool,
        JSON.stringify(input.args || {}),
        input.status,
        input.durationMs ?? null,
        JSON.stringify(input.result || {}),
        input.safety || null,
        input.why || null,
        Date.now(),
      ],
    );
    return id;
  },
  forRun(runId) {
    return db().all('SELECT * FROM tool_executions WHERE run_id = ? ORDER BY ts ASC', [runId]).map(hydrate);
  },
  counts() {
    return db().all('SELECT tool, COUNT(*) AS count FROM tool_executions GROUP BY tool');
  },
};

function hydrate(row) {
  return {
    ...row,
    args: JSON.parse(row.args_json || '{}'),
    result: JSON.parse(row.result_json || '{}'),
  };
}
