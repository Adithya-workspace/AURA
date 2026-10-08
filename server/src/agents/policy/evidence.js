const KIND = {
  analyze_logs: 'logs',
  analyze_transactions: 'transactions',
  check_database: 'database',
  check_queue: 'queue',
  check_security_events: 'security',
  get_service_metrics: 'metrics',
  check_api_health: 'health',
  get_recent_changes: 'changes',
  correlate_errors: 'correlation',
};

export const INSUFFICIENT_NOTE = 'Evidence is insufficient to identify a root cause. Continue investigation using another relevant read-only tool.';

const BASE_REQUIRED = {
  payments: ['logs', 'transactions', 'database', 'changes', 'correlation'],
  authentication: ['security', 'logs', 'changes', 'correlation'],
  orders: ['queue', 'logs', 'changes', 'correlation'],
  notifications: ['queue', 'logs', 'changes', 'correlation'],
  unknown: ['metrics', 'health', 'logs', 'changes', 'correlation'],
};

export function evidenceKinds(toolResults = []) {
  return new Set(
    toolResults
      .filter((item) => item.status === 'completed')
      .map((item) => KIND[item.tool])
      .filter(Boolean),
  );
}

export function requiredKinds(category, toolResults = [], domains = []) {
  let required;
  if (domains.includes('payments') || category === 'payments') required = [...BASE_REQUIRED.payments];
  else if (category === 'inventory' || domains.includes('inventory')) required = ['logs', 'database', 'changes', 'correlation'];
  else if (category === 'checkout' || domains.includes('checkout')) required = ['queue', 'logs', 'changes', 'correlation'];
  else if (category === 'database' || domains.includes('database')) required = ['database', 'logs', 'changes', 'correlation'];
  else if (category === 'deployment' || domains.includes('deployment')) required = ['changes', 'metrics', 'logs', 'correlation'];
  else required = [...(BASE_REQUIRED[category] || BASE_REQUIRED.unknown)];
  if (domains.some((domain) => domain === 'checkout' || domain === 'orders' || domain === 'notifications') && !required.includes('queue')) {
    required.push('queue');
  }
  const blob = JSON.stringify(toolResults);
  if (/DB_TIMEOUT|connection pool|HikariPool/i.test(blob) && !required.includes('database')) required.push('database');
  if (/QUEUE_LAG|orders-queue|email-queue|checkout-queue/i.test(blob) && !required.includes('queue')) required.push('queue');
  if (/JWT|signing key|token/i.test(blob) && !required.includes('security')) required.push('security');
  return required;
}

function supportingSignals(toolResults = []) {
  return toolResults.filter((item) => {
    if (item.status !== 'completed') return false;
    if (item.tool === 'get_recent_changes') return false;
    if (item.tool === 'correlate_errors') return Math.abs(item.data?.score || 0) >= 0.5;
    return (item.findings || []).some((finding) => finding.severity === 'critical' || finding.severity === 'warning')
      || item.tool === 'analyze_logs'
      || item.tool === 'check_database'
      || item.tool === 'check_queue'
      || item.tool === 'check_security_events';
  });
}

export function assessEvidence(toolResults = [], category = 'unknown', options = {}) {
  const completed = toolResults.filter((item) => item.status === 'completed');
  const kinds = evidenceKinds(toolResults);
  const required = requiredKinds(category, toolResults, options.domains || []);
  const missing = required.filter((kind) => !kinds.has(kind));
  const supporting = supportingSignals(toolResults);
  const sufficient = completed.length >= 3 && supporting.length >= 2 && missing.length === 0;
  return {
    sufficient,
    completedCount: completed.length,
    supporting: supporting.length,
    hasCorrelation: kinds.has('correlation'),
    missing,
    kinds: [...kinds],
  };
}
