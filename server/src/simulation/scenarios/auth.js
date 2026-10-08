import { incidentSeries } from '../timeseries.js';

const HOUR = 60 * 60 * 1000;

export function authScenario(now = Date.now()) {
  const series = incidentSeries({
    seed: 4410,
    tracks: [
      { key: 'error_rate', base: 0.01, peak: 0.21, noise: 0.004 },
      { key: 'token_errors', base: 2, peak: 140, noise: 4 },
      { key: 'latency_ms', base: 120, peak: 2400, noise: 20 },
      { key: 'edge_cpu', base: 0.77, peak: 0.79, noise: 0.02 },
    ],
  });
  return {
    key: 'authentication',
    title: 'Login failures after the auth deploy',
    description: 'Users cannot sign in. Token validation errors spiked after the last auth-service deploy. Investigate and resolve if possible.',
    category: 'authentication',
    severity: 'high',
    objective: 'Restore successful sign-in by finding the auth configuration fault.',
    affectedServices: ['auth-service'],
    services: {
      'auth-service': { rps: 210, cpu: 0.38, memory: 0.44, failingEndpoints: ['POST /v1/token', 'POST /v1/login'] },
      'edge-gateway': { rps: 900, cpu: 0.78, memory: 0.41, failingEndpoints: [] },
    },
    databases: {
      'auth-db': { active: 12, max: 50, waitQueue: 0, slowQueries: 1, latencyMs: 18, timeouts: 0 },
    },
    queues: { 'auth-events': { depth: 6, consumers: 2, lagMs: 80, oldestAgeSec: 1 } },
    logs: {
      'auth-service': {
        eventCount: 6402,
        errorCount: 510,
        topErrors: [
          { message: 'JWT_INVALID_SIGNATURE: signing key does not match kid=2026-10-08', count: 388 },
          { message: 'POST /v1/login 401 invalid token', count: 96 },
          { message: 'token introspection timeout', count: 26 },
        ],
        samples: [
          'auth-service ERROR JWT_INVALID_SIGNATURE: signing key does not match kid=2026-10-08',
          'auth-service ERROR POST /v1/login 401 invalid token',
          'auth-service WARN key ring missing active signing key after config push',
        ],
      },
    },
    transactions: null,
    security: { authFailures: 420, tokenErrors: 388, keyMismatch: true },
    changes: [
      { id: 'chg_auth_1', service: 'auth-service', type: 'config', title: 'JWT signing key rotated to kid=2026-10-08', at: now - 35 * 60 * 1000, redHerring: false, note: 'New key id is not in the verifier ring' },
      { id: 'chg_auth_2', service: 'status-page', type: 'deploy', title: 'Status page stylesheet', at: now - 3 * HOUR, redHerring: true, note: 'Unrelated static deploy' },
    ],
    series,
    narrative: {
      timeoutShare: 0.76,
      primaryService: 'auth-service',
      primaryDatabase: 'auth-db',
      primaryQueue: 'auth-events',
      baseline: { errorRate: 0.21, latencyMs: 2400, resource: 0.86, resourceLabel: 'Token failure ratio', resourceThreshold: 0.2, serviceStatus: 'DEGRADED' },
      partial: { errorRate: 0.09, latencyMs: 1100, resource: 0.4 },
      full: { errorRate: 0.01, latencyMs: 280, resource: 0.02 },
      rootCause: 'The latest auth-service config points at JWT signing key kid=2026-10-08, which is not in the verifier key ring.',
      confidence: 92,
      evidence: [
        { signal: 'Signature mismatches', detail: '388 token validation errors cite the new key id', weight: 0.4 },
        { signal: 'Config push', detail: 'JWT signing key change landed 35 minutes ago', weight: 0.35 },
        { signal: 'Healthy database', detail: 'auth-db pool is idle, so this is not a data-layer fault', weight: 0.25 },
      ],
      ruledOut: [
        { hypothesis: 'Credential stuffing', reason: 'Failures are signature mismatches, not bad passwords' },
        { hypothesis: 'Edge CPU', reason: 'Gateway CPU is flat and uncorrelated with the login spike' },
      ],
      primaryFix: {
        tool: 'apply_remediation',
        args: { action: 'rollback_config', params: { service: 'auth-service', changeId: 'chg_auth_1' } },
        title: 'Roll back the JWT signing-key config',
        rationale: 'The previous key ring validates tokens. Rolling back restores sign-in without deleting keys.',
        expectedImpact: 'Token errors should collapse and login latency should return under 300ms.',
        risk: 'medium',
        change: 'kid=2026-10-08 → previous key ring',
      },
      secondFix: {
        tool: 'apply_remediation',
        args: { action: 'restart_service', params: { service: 'auth-service' } },
        title: 'Restart auth-service to drop the cached bad key',
        rationale: 'Rollback landed but workers still cache the broken key id.',
        expectedImpact: 'Flush the key cache and finish recovery.',
        risk: 'medium',
        change: 'restart auth-service',
      },
      safeAlternative: {
        tool: 'apply_remediation',
        args: { action: 'update_rate_limit', params: { service: 'auth-service', limit: 20 } },
        title: 'Throttle login attempts',
        rationale: 'Reduce user-facing errors while identity is reviewed by a human.',
        expectedImpact: 'Fewer failed logins, more users waiting.',
        risk: 'low',
        change: 'login limit → 20 rps',
      },
    },
    plan: [
      { id: 'a1', title: 'Read auth-service security signals', toolHint: 'check_security_events' },
      { id: 'a2', title: 'Inspect auth logs', toolHint: 'analyze_logs' },
      { id: 'a3', title: 'Check auth API health', toolHint: 'check_api_health' },
      { id: 'a4', title: 'Review the latest config push', toolHint: 'get_recent_changes' },
      { id: 'a5', title: 'Correlate token errors with the deploy', toolHint: 'correlate_errors' },
      { id: 'a6', title: 'Propose a config rollback', toolHint: 'rollback_config' },
    ],
  };
}
