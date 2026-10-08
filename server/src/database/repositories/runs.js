import { db } from '../db.js';
import { newId } from '../../utils/ids.js';

export const runsRepo = {
  create({ incidentId, mode, provider }) {
    const id = newId('run');
    const now = Date.now();
    db().run(
      `INSERT INTO agent_runs (id, incident_id, status, mode, llm_provider, started_at, ended_at, attempts)
       VALUES (?, ?, 'running', ?, ?, ?, NULL, 0)`,
      [id, incidentId, mode, provider, now],
    );
    return this.get(id);
  },
  get(id) {
    return db().get('SELECT * FROM agent_runs WHERE id = ?', [id]);
  },
  list() {
    return db().all('SELECT * FROM agent_runs ORDER BY started_at DESC');
  },
  forIncident(incidentId) {
    return db().all('SELECT * FROM agent_runs WHERE incident_id = ? ORDER BY started_at DESC', [incidentId]);
  },
  update(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    db().run(`UPDATE agent_runs SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.get(id);
  },
  activeForIncident(incidentId) {
    return db().get(
      `SELECT * FROM agent_runs WHERE incident_id = ? AND status IN ('running', 'awaiting_approval') ORDER BY started_at DESC`,
      [incidentId],
    );
  },
};
