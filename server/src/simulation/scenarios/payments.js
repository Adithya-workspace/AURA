import { incidentSeries } from '../timeseries.js';

const HOUR = 60 * 60 * 1000;

export function paymentsScenario(now = Date.now()) {
  const series = incidentSeries({
    seed: 1208,
    tracks: [
      { key: 'error_rate', base: 0.012, peak: 0.184, noise: 0.004 },
      { key: 'db_utilization', base: 0.41, peak: 0.98, noise: 0.015 },
      { key: 'db_timeouts', base: 1, peak: 28, noise: 1.2 },
      { key: 'latency_ms', base: 280, peak: 4800, noise: 40 },
      { key: 'checkout_cpu', base: 0.9, peak: 0.91, noise: 0.02 },
    ],
  });

  return {
    key: 'payments',
    title: 'Payment failures have suddenly increased',
    description: 'Payment failures have suddenly increased. Investigate the problem and resolve it if possible.',
    category: 'payments',
    severity: 'critical',
    objective: 'Find why payment charge failures spiked and restore the payment path safely.',
    affectedServices: ['payment-service', 'payments-db'],
    services: {
      'payment-service': { rps: 126, cpu: 0.47, memory: 0.63, failingEndpoints: ['POST /v1/charge', 'POST /v1/capture'] },
      'checkout-service': { rps: 84, cpu: 0.91, memory: 0.55, failingEndpoints: [] },
      'ledger-service': { rps: 40, cpu: 0.22, memory: 0.31, failingEndpoints: [] },
    },
    databases: {
      'payments-db': { active: 98, max: 100, waitQueue: 46, slowQueries: 19, latencyMs: 840, timeouts: 302 },
    },
    queues: {
      'payments-events': { depth: 18, consumers: 4, lagMs: 420, oldestAgeSec: 4 },
    },
    logs: {
      'payment-service': {
        eventCount: 12482,
        errorCount: 347,
        topErrors: [
          { message: 'DB_TIMEOUT: could not acquire connection from pool after 5000ms', count: 302 },
          { message: 'POST /v1/charge 504', count: 28 },
          { message: 'HikariPool-1 - Connection is not available, request timed out', count: 17 },
        ],
        samples: [
          'payment-service ERROR DB_TIMEOUT: could not acquire connection from pool after 5000ms',
          'payment-service ERROR POST /v1/charge 504 gateway timeout upstream',
          'payment-service ERROR HikariPool-1 - Connection is not available, request timed out',
          'payment-service WARN retrying charge charge_8f21 method=card',
          'payment-service INFO charge accepted charge_1aa0 method=upi',
        ],
      },
    },
    transactions: {
      total: 1886,
      failed: 347,
      byReason: { DB_TIMEOUT: 302, GATEWAY_TIMEOUT: 28, OTHER: 17 },
      byMethod: { card: 180, upi: 92, netbanking: 48, wallet: 27 },
    },
    security: { authFailures: 4, tokenErrors: 1, keyMismatch: false },
    changes: [
      { id: 'chg_pay_1', service: 'payment-service', type: 'deploy', title: 'v2.4.1 dependency bump', at: now - 2 * HOUR, redHerring: true, note: 'No error-rate change at deploy time' },
      { id: 'chg_pay_2', service: 'checkout-service', type: 'deploy', title: 'Checkout copy update', at: now - 5 * HOUR, redHerring: true, note: 'Unrelated UI deploy' },
    ],
    series,
    narrative: {
      timeoutShare: 0.87,
      primaryService: 'payment-service',
      primaryDatabase: 'payments-db',
      primaryQueue: 'payments-events',
      baseline: { errorRate: 0.184, latencyMs: 4800, resource: 0.98, resourceLabel: 'DB utilization', resourceThreshold: 0.75, serviceStatus: 'DEGRADED' },
      partial: { errorRate: 0.07, latencyMs: 2100, resource: 0.78 },
      full: { errorRate: 0.012, latencyMs: 620, resource: 0.61 },
      rootCause: 'payments-db connection pool is exhausted (98/100). Charge requests time out waiting for a connection.',
      confidence: 94,
      evidence: [
        { signal: 'DB pool saturation', detail: '98 active connections of 100, wait queue 46', weight: 0.34 },
        { signal: 'Timeout dominance', detail: '302 of 347 errors are DB_TIMEOUT (87%)', weight: 0.28 },
        { signal: 'Correlated onset', detail: 'Error rate, latency, and DB utilization rise together', weight: 0.22 },
        { signal: 'API degradation', detail: 'POST /v1/charge is returning 504', weight: 0.16 },
      ],
      ruledOut: [
        { hypothesis: 'Checkout-service CPU saturation', reason: 'CPU is high all window and does not correlate with the error onset' },
        { hypothesis: 'Bad payment-service deploy', reason: 'v2.4.1 was a dependency bump two hours before the spike' },
      ],
      primaryFix: {
        tool: 'apply_remediation',
        args: { action: 'update_db_pool_size', params: { database: 'payments-db', size: 200 } },
        title: 'Increase payments-db pool from 100 to 200',
        rationale: 'The pool is fully checked out. Raising the limit lets queued charges acquire a connection.',
        expectedImpact: 'Error rate should fall under 3% and p95 latency under one second.',
        risk: 'medium',
        change: '100 → 200',
      },
      secondFix: {
        tool: 'apply_remediation',
        args: { action: 'restart_service', params: { service: 'payment-service' } },
        title: 'Restart payment-service to drop stuck connections',
        rationale: 'The larger pool helped, but leaked connections are still holding the error rate above the recovery bar.',
        expectedImpact: 'Recycle the pool and finish the drop from 7% to about 1.2%.',
        risk: 'medium',
        change: 'restart payment-service',
      },
      safeAlternative: {
        tool: 'apply_remediation',
        args: { action: 'update_rate_limit', params: { service: 'payment-service', limit: 40 } },
        title: 'Temporarily lower the charge rate limit',
        rationale: 'Shed load without changing pool configuration while a human takes over.',
        expectedImpact: 'Fewer new timeouts, at the cost of rejected checkouts.',
        risk: 'low',
        change: 'rate limit → 40 rps',
      },
    },
    plan: [
      { id: 'p1', title: 'Read payment-service error logs', toolHint: 'analyze_logs' },
      { id: 'p2', title: 'Check payment API health', toolHint: 'check_api_health' },
      { id: 'p3', title: 'Sample live service metrics', toolHint: 'get_service_metrics' },
      { id: 'p4', title: 'Break down failed charges', toolHint: 'analyze_transactions' },
      { id: 'p5', title: 'Inspect the payments database pool', toolHint: 'check_database' },
      { id: 'p6', title: 'Review recent deploys for decoys', toolHint: 'get_recent_changes' },
      { id: 'p7', title: 'Correlate errors with resource timelines', toolHint: 'correlate_errors' },
      { id: 'p8', title: 'Rank root-cause hypotheses', toolHint: 'analyze' },
      { id: 'p9', title: 'Propose a reversible remediation', toolHint: 'apply_remediation' },
    ],
  };
}
