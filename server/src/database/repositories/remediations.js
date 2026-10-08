import { db } from '../db.js';
import { newId } from '../../utils/ids.js';

export const remediationsRepo = {
  create(input) {
    const id = newId('rem');
    db().run(
      `INSERT INTO remediation_actions
        (id, incident_id, run_id, tool, args_json, args_hash, title, rationale, risk, status, decided_at, executed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', NULL, NULL)`,
      [id, input.incidentId, input.runId, input.tool, JSON.stringify(input.args), input.argsHash, input.title, input.rationale, input.risk],
    );
    return this.get(id);
  },
  get(id) {
    const row = db().get('SELECT * FROM remediation_actions WHERE id = ?', [id]);
    return row ? hydrate(row) : null;
  },
  forIncident(incidentId) {
    return db().all('SELECT * FROM remediation_actions WHERE incident_id = ? ORDER BY rowid ASC', [incidentId]).map(hydrate);
  },
  mark(id, status, extra = {}) {
    const current = this.get(id);
    if (!current) return null;
    const decided = extra.decidedAt ?? (status === 'approved' || status === 'rejected' ? Date.now() : current.decided_at);
    const executed = extra.executedAt ?? (status === 'executed' || status === 'failed' ? Date.now() : current.executed_at);
    db().run(
      'UPDATE remediation_actions SET status = ?, decided_at = ?, executed_at = ? WHERE id = ?',
      [status, decided, executed, id],
    );
    return this.get(id);
  },
};

function hydrate(row) {
  return { ...row, args: JSON.parse(row.args_json || '{}') };
}
