import { db } from '../db.js';

export const reportsRepo = {
  save(incidentId, markdown, json) {
    const existing = db().get('SELECT incident_id FROM reports WHERE incident_id = ?', [incidentId]);
    const now = Date.now();
    if (existing) {
      db().run('UPDATE reports SET markdown = ?, json = ?, created_at = ? WHERE incident_id = ?', [markdown, JSON.stringify(json), now, incidentId]);
    } else {
      db().run('INSERT INTO reports (incident_id, markdown, json, created_at) VALUES (?, ?, ?, ?)', [incidentId, markdown, JSON.stringify(json), now]);
    }
    return this.get(incidentId);
  },
  get(incidentId) {
    const row = db().get('SELECT * FROM reports WHERE incident_id = ?', [incidentId]);
    if (!row) return null;
    return { ...row, data: JSON.parse(row.json) };
  },
};
