import { incidentSeries } from '../timeseries.js';

const HOUR = 60 * 60 * 1000;

export function notificationsScenario(now = Date.now()) {
  const series = incidentSeries({
    seed: 9099,
    tracks: [
      { key: 'error_rate', base: 0.02, peak: 0.27, noise: 0.005 },
      { key: 'provider_rejects', base: 0.02, peak: 0.92, noise: 0.02 },
      { key: 'latency_ms', base: 300, peak: 5100, noise: 40 },
      { key: 'template_cpu', base: 0.7, peak: 0.72, noise: 0.02 },
    ],
  });
  return {
    key: 'notifications',
    title: 'Notification delivery has stalled',
    description: 'Email notifications are failing. The provider circuit breaker is open. Investigate and resolve if possible.',
    category: 'notifications',
    severity: 'medium',
    objective: 'Restore notification delivery without dropping the message backlog.',
    affectedServices: ['notification-service', 'email-queue'],
    services: {
      'notification-service': { rps: 55, cpu: 0.33, memory: 0.4, failingEndpoints: ['POST /v1/notify'] },
      'template-service': { rps: 40, cpu: 0.71, memory: 0.36, failingEndpoints: [] },
    },
    databases: {
      'notify-db': { active: 8, max: 40, waitQueue: 0, slowQueries: 0, latencyMs: 12, timeouts: 0 },
    },
    queues: {
      'email-queue': { depth: 860, consumers: 3, lagMs: 180000, oldestAgeSec: 700 },
    },
    logs: {
      'notification-service': {
        eventCount: 5104,
        errorCount: 266,
        topErrors: [
          { message: 'PROVIDER_RATE_LIMIT: sendgrid 429 circuit=open', count: 210 },
          { message: 'email-queue message nacked after provider timeout', count: 56 },
        ],
        samples: [
          'notification-service ERROR PROVIDER_RATE_LIMIT: sendgrid 429 circuit=open',
          'notification-service WARN fallback provider ses is configured but not selected',
          'notification-service INFO template render ok template=receipt',
        ],
      },
    },
    transactions: null,
    security: { authFailures: 0, tokenErrors: 0, keyMismatch: false },
    changes: [
      { id: 'chg_ntf_1', service: 'template-service', type: 'deploy', title: 'Receipt template spacing', at: now - 6 * HOUR, redHerring: true, note: 'Templates render successfully' },
      { id: 'chg_ntf_2', service: 'notification-service', type: 'config', title: 'Primary provider remains sendgrid', at: now - 2 * HOUR, redHerring: false, note: 'No fallback cutover' },
    ],
    series,
    narrative: {
      timeoutShare: 0.79,
      primaryService: 'notification-service',
      primaryDatabase: 'notify-db',
      primaryQueue: 'email-queue',
      baseline: { errorRate: 0.27, latencyMs: 5100, resource: 0.92, resourceLabel: 'Provider reject rate', resourceThreshold: 0.2, serviceStatus: 'DEGRADED' },
      partial: { errorRate: 0.11, latencyMs: 2200, resource: 0.45 },
      full: { errorRate: 0.018, latencyMs: 640, resource: 0.04 },
      rootCause: 'SendGrid is rate-limiting the notification-service and the circuit breaker is open. The SES fallback is configured but unused.',
      confidence: 90,
      evidence: [
        { signal: 'Provider 429s', detail: '210 errors are PROVIDER_RATE_LIMIT from sendgrid', weight: 0.42 },
        { signal: 'Open circuit', detail: 'email-queue is nacking after provider timeouts', weight: 0.33 },
        { signal: 'Templates are healthy', detail: 'template-service renders successfully', weight: 0.25 },
      ],
      ruledOut: [
        { hypothesis: 'Template deploy broke rendering', reason: 'Render logs succeed and CPU is a flat decoy' },
        { hypothesis: 'Database outage', reason: 'notify-db is idle' },
      ],
      primaryFix: {
        tool: 'apply_remediation',
        args: { action: 'switch_provider', params: { service: 'notification-service', provider: 'ses' } },
        title: 'Switch email provider to the SES fallback',
        rationale: 'SES is already configured. Moving traffic off the rate-limited provider closes the circuit.',
        expectedImpact: 'Reject rate should fall under 5% and the queue should drain.',
        risk: 'medium',
        change: 'sendgrid → ses',
      },
      secondFix: {
        tool: 'apply_remediation',
        args: { action: 'restart_service', params: { service: 'notification-service' } },
        title: 'Restart notification-service to reset the circuit breaker',
        rationale: 'The provider switch stuck behind an open breaker.',
        expectedImpact: 'Breaker closes and delivery resumes.',
        risk: 'medium',
        change: 'restart notification-service',
      },
      safeAlternative: {
        tool: 'apply_remediation',
        args: { action: 'update_rate_limit', params: { service: 'notification-service', limit: 5 } },
        title: 'Slow outbound email to stay under the provider cap',
        rationale: 'Stay on SendGrid but under the limit while a human decides.',
        expectedImpact: 'Fewer 429s, slower delivery.',
        risk: 'low',
        change: 'send rate → 5 rps',
      },
    },
    plan: [
      { id: 'n1', title: 'Inspect the email queue', toolHint: 'check_queue' },
      { id: 'n2', title: 'Read notification logs', toolHint: 'analyze_logs' },
      { id: 'n3', title: 'Check notification API health', toolHint: 'check_api_health' },
      { id: 'n4', title: 'Review recent template and provider changes', toolHint: 'get_recent_changes' },
      { id: 'n5', title: 'Correlate rejects with provider errors', toolHint: 'correlate_errors' },
    ],
  };
}
