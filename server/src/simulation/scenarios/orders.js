import { incidentSeries } from '../timeseries.js';

const HOUR = 60 * 60 * 1000;

export function ordersScenario(now = Date.now()) {
  const series = incidentSeries({
    seed: 7781,
    tracks: [
      { key: 'error_rate', base: 0.008, peak: 0.16, noise: 0.004 },
      { key: 'queue_lag', base: 2, peak: 240, noise: 6 },
      { key: 'latency_ms', base: 220, peak: 3600, noise: 30 },
      { key: 'catalog_cpu', base: 0.84, peak: 0.86, noise: 0.02 },
    ],
  });
  return {
    key: 'orders',
    title: 'Order processing is falling behind',
    description: 'Orders are accepted but fulfillment is delayed. The order queue is growing. Investigate and resolve if possible.',
    category: 'orders',
    severity: 'high',
    objective: 'Drain the order backlog and restore fulfillment latency.',
    affectedServices: ['order-service', 'orders-queue'],
    services: {
      'order-service': { rps: 70, cpu: 0.52, memory: 0.48, failingEndpoints: ['POST /v1/orders'] },
      'catalog-service': { rps: 300, cpu: 0.85, memory: 0.6, failingEndpoints: [] },
    },
    databases: {
      'orders-db': { active: 20, max: 80, waitQueue: 1, slowQueries: 3, latencyMs: 40, timeouts: 2 },
    },
    queues: {
      'orders-queue': { depth: 1480, consumers: 2, lagMs: 240000, oldestAgeSec: 940 },
    },
    logs: {
      'order-service': {
        eventCount: 4020,
        errorCount: 188,
        topErrors: [
          { message: 'QUEUE_LAG: consumer behind by 240s on orders-queue', count: 140 },
          { message: 'POST /v1/orders 202 accepted but fulfillment SLA breached', count: 48 },
        ],
        samples: [
          'order-service ERROR QUEUE_LAG: consumer behind by 240s on orders-queue',
          'order-service WARN only 2 workers polling orders-queue',
          'order-service INFO order ord_19 accepted',
        ],
      },
    },
    transactions: null,
    security: { authFailures: 0, tokenErrors: 0, keyMismatch: false },
    changes: [
      { id: 'chg_ord_1', service: 'catalog-service', type: 'deploy', title: 'Catalog search ranking tweak', at: now - 4 * HOUR, redHerring: true, note: 'Catalog CPU is high but flat' },
      { id: 'chg_ord_2', service: 'order-service', type: 'deploy', title: 'Order receipt email copy', at: now - 26 * HOUR, redHerring: true, note: 'No worker-count change' },
    ],
    series,
    narrative: {
      timeoutShare: 0.74,
      primaryService: 'order-service',
      primaryDatabase: 'orders-db',
      primaryQueue: 'orders-queue',
      baseline: { errorRate: 0.16, latencyMs: 3600, resource: 240, resourceLabel: 'Queue lag (s)', resourceThreshold: 30, serviceStatus: 'DEGRADED' },
      partial: { errorRate: 0.08, latencyMs: 1600, resource: 90 },
      full: { errorRate: 0.015, latencyMs: 480, resource: 12 },
      rootCause: 'orders-queue has only 2 consumers. Lag is 240s and the oldest message is over 15 minutes old.',
      confidence: 91,
      evidence: [
        { signal: 'Consumer starvation', detail: '2 workers against a depth of 1480', weight: 0.4 },
        { signal: 'Lag correlation', detail: 'Order errors track queue lag, not catalog CPU', weight: 0.35 },
        { signal: 'Database is fine', detail: 'orders-db utilization is low', weight: 0.25 },
      ],
      ruledOut: [
        { hypothesis: 'Catalog CPU', reason: 'CPU is high but flat and does not match the lag onset' },
        { hypothesis: 'Database saturation', reason: 'orders-db has spare connections' },
      ],
      primaryFix: {
        tool: 'apply_remediation',
        args: { action: 'scale_workers', params: { queue: 'orders-queue', workers: 6 } },
        title: 'Scale order workers from 2 to 6',
        rationale: 'Three times the consumers can drain the backlog inside the fulfillment SLA.',
        expectedImpact: 'Queue lag should fall under 30 seconds.',
        risk: 'low',
        change: '2 → 6 workers',
      },
      secondFix: {
        tool: 'apply_remediation',
        args: { action: 'restart_service', params: { service: 'order-service' } },
        title: 'Restart order-service so new workers attach',
        rationale: 'The scale command registered, but existing pollers did not pick up the new concurrency.',
        expectedImpact: 'Attach all 6 workers and finish draining the queue.',
        risk: 'medium',
        change: 'restart order-service',
      },
      safeAlternative: {
        tool: 'apply_remediation',
        args: { action: 'update_rate_limit', params: { service: 'order-service', limit: 15 } },
        title: 'Slow new order intake',
        rationale: 'Stop the backlog from growing while a human adds capacity.',
        expectedImpact: 'Lag stops rising. Existing orders still wait.',
        risk: 'low',
        change: 'intake → 15 rps',
      },
    },
    plan: [
      { id: 'o1', title: 'Measure orders-queue depth and lag', toolHint: 'check_queue' },
      { id: 'o2', title: 'Read order-service logs', toolHint: 'analyze_logs' },
      { id: 'o3', title: 'Check order API health', toolHint: 'check_api_health' },
      { id: 'o4', title: 'Sample order-service metrics', toolHint: 'get_service_metrics' },
      { id: 'o5', title: 'Review recent changes', toolHint: 'get_recent_changes' },
      { id: 'o6', title: 'Correlate lag with errors', toolHint: 'correlate_errors' },
    ],
  };
}
