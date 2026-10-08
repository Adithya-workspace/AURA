import { db } from '../db.js';
import { newId } from '../../utils/ids.js';

export const problemsRepo = {
  replace(incidentId, problems) {
    db().run('DELETE FROM discovered_problems WHERE incident_id = ?', [incidentId]);
    const now = Date.now();
    for (const problem of problems) {
      db().run(
        `INSERT INTO discovered_problems
          (id, incident_id, title, description, severity, confidence, type, affected_services_json, evidence_json, causes_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          problem.id || newId('prb'),
          incidentId,
          problem.title,
          problem.description || '',
          problem.severity || 'medium',
          problem.confidence ?? null,
          problem.type,
          JSON.stringify(problem.affectedServices || []),
          JSON.stringify(problem.evidence || []),
          JSON.stringify(problem.causes || []),
          problem.status || 'open',
          now,
        ],
      );
    }
  },
  list(incidentId) {
    return db().all('SELECT * FROM discovered_problems WHERE incident_id = ? ORDER BY created_at ASC', [incidentId]).map((row) => ({
      id: row.id,
      incidentId: row.incident_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      confidence: row.confidence,
      type: row.type,
      affectedServices: JSON.parse(row.affected_services_json || '[]'),
      evidence: JSON.parse(row.evidence_json || '[]'),
      causes: JSON.parse(row.causes_json || '[]'),
      status: row.status,
    }));
  },
};
