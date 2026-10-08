import { db } from '../db.js';
import { newId } from '../../utils/ids.js';

export const incidentsRepo = {
  create(input) {
    const id = newId('inc');
    const now = Date.now();
    db().run(
      `INSERT INTO incidents (id, title, description, category, severity, status, scenario_key, service, environment, timeframe, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        input.title,
        input.description,
        input.category || null,
        input.severity || 'medium',
        input.scenarioKey || null,
        input.service || null,
        input.environment || null,
        input.timeframe || null,
        now,
      ],
    );
    return this.get(id);
  },
  get(id) {
    return db().get('SELECT * FROM incidents WHERE id = ?', [id]);
  },
  list({ status, severity } = {}) {
    const clauses = [];
    const params = [];
    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }
    if (severity) {
      clauses.push('severity = ?');
      params.push(severity);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db().all(`SELECT * FROM incidents ${where} ORDER BY created_at DESC`, params);
  },
  update(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    db().run(`UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.get(id);
  },
};
