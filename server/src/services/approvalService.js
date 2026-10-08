import { hashArgs } from '../utils/hash.js';

const waiters = new Map();
const early = new Map();

function keyOf(incidentId, remediationId) {
  return `${incidentId}:${remediationId}`;
}

export function approvalMatches(record, tool, args) {
  if (!record) return false;
  if (record.status !== 'approved' && record.status !== 'executed') return false;
  if (record.tool !== tool) return false;
  return record.args_hash === hashArgs(tool, args);
}

export function waitForDecision(incidentId, remediationId) {
  const key = keyOf(incidentId, remediationId);
  if (early.has(key)) {
    const decision = early.get(key);
    early.delete(key);
    return Promise.resolve(decision);
  }
  return new Promise((resolve) => {
    waiters.set(key, resolve);
  });
}

export function submitDecision(incidentId, remediationId, decision) {
  const key = keyOf(incidentId, remediationId);
  const resolve = waiters.get(key);
  if (resolve) {
    waiters.delete(key);
    resolve(decision);
    return 'delivered';
  }
  early.set(key, decision);
  return 'queued';
}

export function hashRemediation(tool, args) {
  return hashArgs(tool, args);
}
