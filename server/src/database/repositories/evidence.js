import { db } from '../db.js';
import { newId } from '../../utils/ids.js';

export const evidenceRepo = {
  add(incidentId, file) {
    const id = newId('evd');
    db().run(
      'INSERT INTO incident_evidence (id, incident_id, filename, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, incidentId, file.filename, file.content, Date.now()],
    );
    return id;
  },
  list(incidentId) {
    return db().all(
      'SELECT id, incident_id, filename, content, created_at FROM incident_evidence WHERE incident_id = ? ORDER BY created_at ASC',
      [incidentId],
    );
  },
};
