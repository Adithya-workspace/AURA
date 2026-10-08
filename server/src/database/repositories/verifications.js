import { db } from '../db.js';
import { newId } from '../../utils/ids.js';

export const verificationsRepo = {
  insert(input) {
    const id = newId('ver');
    db().run(
      `INSERT INTO verification_results (id, incident_id, run_id, before_json, after_json, verdict, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.incidentId, input.runId, JSON.stringify(input.before), JSON.stringify(input.after), input.verdict, Date.now()],
    );
    return this.latest(input.incidentId);
  },
  latest(incidentId) {
    const row = db().get(
      'SELECT * FROM verification_results WHERE incident_id = ? ORDER BY ts DESC LIMIT 1',
      [incidentId],
    );
    if (!row) return null;
    return { ...row, before: JSON.parse(row.before_json), after: JSON.parse(row.after_json) };
  },
  forRun(runId) {
    return db().all('SELECT * FROM verification_results WHERE run_id = ? ORDER BY ts ASC', [runId]).map((row) => ({
      ...row,
      before: JSON.parse(row.before_json),
      after: JSON.parse(row.after_json),
    }));
  },
};
