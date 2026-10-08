import { assessEvidence } from './evidence.js';

const SEQUENCES = {
  payments: [
    { tool: 'analyze_logs', args: { service: 'payment-service', timeframe: '30m' }, why: 'Payment errors should show up in the service log first.' },
    { tool: 'check_api_health', args: { service: 'payment-service' }, why: 'Confirm whether the charge endpoints are degraded.' },
    { tool: 'get_service_metrics', args: { service: 'payment-service' }, why: 'Quantify error rate and latency before blaming a dependency.' },
    { tool: 'analyze_transactions', args: { timeframe: '30m' }, why: 'Separate database timeouts from other charge failures.' },
    { tool: 'check_database', args: { database: 'payments-db' }, why: 'The timeouts point at the connection pool.' },
    { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'Check whether a recent deploy explains the spike.' },
    { tool: 'correlate_errors', args: { signals: ['db_utilization', 'db_timeouts', 'latency_ms', 'checkout_cpu'] }, why: 'Test whether database pressure, timeouts, and latency move with payment failures, or whether the busy checkout service is a decoy.' },
  ],
  authentication: [
    { tool: 'check_security_events', args: { timeframe: '30m' }, why: 'Login failures usually start as token or key errors.' },
    { tool: 'analyze_logs', args: { service: 'auth-service', timeframe: '30m' }, why: 'Read the signature errors in the auth log.' },
    { tool: 'check_api_health', args: { service: 'auth-service' }, why: 'See which auth endpoints are failing.' },
    { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'A signing-key push is a likely trigger.' },
    { tool: 'correlate_errors', args: { signals: ['token_errors', 'latency_ms', 'edge_cpu'] }, why: 'Check that token errors, not edge CPU, track the outage.' },
  ],
  orders: [
    { tool: 'check_queue', args: { queue: 'orders-queue' }, why: 'Fulfillment delays usually show up as queue lag.' },
    { tool: 'analyze_logs', args: { service: 'order-service', timeframe: '30m' }, why: 'Confirm the lag messages in the order log.' },
    { tool: 'get_service_metrics', args: { service: 'order-service' }, why: 'See whether the order service itself is saturated.' },
    { tool: 'check_api_health', args: { service: 'order-service' }, why: 'Check whether order intake is degraded.' },
    { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'Look for a worker change or an unrelated deploy.' },
    { tool: 'correlate_errors', args: { signals: ['queue_lag', 'latency_ms', 'catalog_cpu'] }, why: 'Compare queue lag with the catalog CPU decoy.' },
  ],
  notifications: [
    { tool: 'check_queue', args: { queue: 'email-queue' }, why: 'Stalled mail piles up in the email queue.' },
    { tool: 'analyze_logs', args: { service: 'notification-service', timeframe: '30m' }, why: 'Look for provider rate-limit errors.' },
    { tool: 'check_api_health', args: { service: 'notification-service' }, why: 'Confirm the notify endpoint is degraded.' },
    { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'Separate a template deploy from the provider fault.' },
    { tool: 'correlate_errors', args: { signals: ['provider_rejects', 'latency_ms', 'template_cpu'] }, why: 'See whether provider rejects match the error onset.' },
  ],
  unknown: [
    { tool: 'get_service_metrics', args: { service: 'payment-service' }, why: 'Measure error rate and latency before treating a recent deploy as the cause.' },
    { tool: 'check_api_health', args: { service: 'payment-service' }, why: 'See whether the API is actually degraded.' },
    { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'Record the deploy, then test it against the error onset.' },
    { tool: 'analyze_logs', args: { service: 'payment-service', timeframe: '30m' }, why: 'Logs show whether errors changed with the deploy or point at another fault.' },
    { tool: 'analyze_transactions', args: { timeframe: '30m' }, why: 'Separate database timeouts from provider or gateway failures.' },
    { tool: 'check_database', args: { database: 'payments-db' }, why: 'A timeout spike needs a pool reading before the deploy is blamed.' },
    { tool: 'correlate_errors', args: { signals: ['db_utilization', 'db_timeouts', 'latency_ms', 'checkout_cpu'] }, why: 'Compare the deploy window with database pressure, timeouts, latency, and the CPU decoy.' },
  ],
};

function remediationOf(fix) {
  if (!fix) return null;
  return {
    tool: fix.tool,
    args: fix.args,
    title: fix.title,
    rationale: fix.rationale,
    expectedImpact: fix.expectedImpact,
    risk: fix.risk,
  };
}

function shouldSkipDatabase(toolResults) {
  const logs = (toolResults || []).find((item) => item.tool === 'analyze_logs' && item.status === 'completed');
  if (!logs) return false;
  const blob = JSON.stringify(logs.data || logs.summary || '');
  return !/DB_TIMEOUT|connection|slow query|500/i.test(blob);
}

function isUsed(step, toolResults) {
  return (toolResults || []).some((item) => {
    if (item.tool !== step.tool) return false;
    if (!item.args || !step.args) return true;
    return JSON.stringify(item.args) === JSON.stringify(step.args);
  });
}

export function nextInvestigation({ category, toolResults, steps = null, noTelemetry = false }) {
  if (noTelemetry) {
    return {
      action: 'finish_investigation',
      why: 'No connected telemetry matches this incident. Further tool calls would invent a check.',
    };
  }
  const sequence = steps?.length ? steps : (SEQUENCES[category] || SEQUENCES.unknown);
  for (const step of sequence) {
    if (isUsed(step, toolResults)) continue;
    if (step.tool === 'check_database' && shouldSkipDatabase(toolResults)) continue;
    return { action: 'call_tool', tool: step.tool, args: step.args, why: step.why };
  }
  const assessment = assessEvidence(toolResults, category);
  if (!assessment.sufficient) {
    return {
      action: 'finish_investigation',
      why: 'No further read-only tool would add an independent signal.',
    };
  }
  return { action: 'finish_investigation', why: 'Independent signals agree, and a recent change has been checked against the error onset.' };
}

export function fallbackDecision(schemaName, context) {
  const world = context.world;
  const narrative = world?.narrative;
  const category = context.category || world?.category || 'unknown';

  if (schemaName === 'understand') {
    return {
      category,
      severity: world?.severity || 'medium',
      objective: world?.objective || 'Investigate the report and escalate if the evidence is thin.',
      affectedServices: world?.affectedServices || [],
      symptoms: world?.symptoms || [],
      suspectedDomains: world?.domains || [category],
      investigationStrategy: [
        'Choose read-only tools from the catalog that match the reported services and the evidence still missing.',
        'Do not finish while an independent signal is still available.',
      ],
      plan: world?.plan || [{ id: 'u1', title: 'Collect service metrics', toolHint: 'get_service_metrics' }],
    };
  }

  if (schemaName === 'investigate_step') {
    return nextInvestigation({
      category: world?.custom ? (world.investigationSteps?.length ? 'custom' : category) : category,
      toolResults: context.toolResults || [],
      steps: world?.investigationSteps || null,
      noTelemetry: Boolean(world?.noTelemetry),
    });
  }

  if (schemaName === 'alternative') {
    if (context.alternativeUsed || !narrative?.safeAlternative) {
      return {
        rootCause: narrative?.rootCause || 'Unresolved',
        confidence: narrative?.confidence || 40,
        evidence: narrative?.evidence || [],
        ruledOut: narrative?.ruledOut || [],
        remediation: null,
      };
    }
    return {
      rootCause: narrative.rootCause,
      confidence: narrative.confidence,
      evidence: narrative.evidence,
      ruledOut: narrative.ruledOut,
      remediation: remediationOf(narrative.safeAlternative),
    };
  }

  const completed = (context.toolResults || []).filter((item) => item.status === 'completed');
  if (world?.noTelemetry) {
    return {
      rootCause: narrative?.rootCause || 'Insufficient telemetry available to confidently determine the root cause.',
      confidence: 18,
      evidence: narrative?.evidence || [{ signal: 'Telemetry', detail: 'No connected service matches this report.', weight: 1 }],
      ruledOut: [],
      remediation: null,
    };
  }
  const assessment = assessEvidence(completed, category, { domains: world?.domains || [] });
  if (!assessment.sufficient || !narrative) {
    return {
      rootCause: 'The report does not contain enough corroborated evidence to name a cause.',
      confidence: Math.min(40, 15 + assessment.supporting * 8),
      evidence: [{
        signal: 'Thin evidence',
        detail: assessment.missing.length
          ? `Still missing ${assessment.missing.join(', ')}`
          : 'Fewer than two independent supporting signals',
        weight: 1,
      }],
      ruledOut: [],
      remediation: null,
    };
  }

  const scored = scoreEvidence(completed, category, narrative, world?.domains || []);
  const queued = Array.isArray(world?.fixes) ? world.fixes.find((fix) => !fix.applied) : null;
  const fix = queued ? queued.proposal : (context.executed > 0 ? narrative.secondFix : narrative.primaryFix);
  const open = (world?.problems || []).filter((problem) => problem.status !== 'resolved' && problem.type !== 'unrelated');
  const rootCause = context.executed > 0 && open.length
    ? `Primary fault improved. Still open: ${open.map((problem) => problem.title).join('; ')}`
    : scored.rootCause;
  return {
    rootCause,
    confidence: scored.confidence,
    evidence: scored.evidence,
    ruledOut: scored.ruledOut,
    remediation: fix && scored.confidence >= 70 ? remediationOf(fix) : null,
  };
}

function scoreEvidence(results, category, narrative, domains = []) {
  const db = results.find((item) => item.tool === 'check_database')?.data;
  const tx = results.find((item) => item.tool === 'analyze_transactions')?.data;
  const metrics = results.find((item) => item.tool === 'get_service_metrics')?.data;
  const logs = results.find((item) => item.tool === 'analyze_logs')?.data;
  const corr = results.find((item) => item.tool === 'correlate_errors')?.data;
  const changes = results.find((item) => item.tool === 'get_recent_changes')?.data?.changes || [];
  const security = results.find((item) => item.tool === 'check_security_events')?.data;
  const queues = results.filter((item) => item.tool === 'check_queue' && item.data).map((item) => item.data);
  const queue = queues[0];
  const evidence = [];

  if (db) {
    evidence.push({
      signal: 'Database pool',
      detail: `${db.active}/${db.max} connections, ${Math.round(db.utilization * 100)}% utilization, ${db.timeouts} timeouts`,
      weight: db.utilization >= 0.9 ? 0.34 : 0.12,
    });
  }
  if (tx) {
    evidence.push({
      signal: 'Payment failures',
      detail: `${(tx.failureRate * 100).toFixed(1)}% failed, ${tx.byReason?.DB_TIMEOUT || 0} database timeouts`,
      weight: (tx.byReason?.DB_TIMEOUT || 0) > 50 ? 0.22 : 0.1,
    });
  }
  if (logs?.errorCount) {
    evidence.push({
      signal: 'Error log',
      detail: `${logs.errorCount} errors in ${logs.eventCount} events. Top: ${logs.topErrors?.[0]?.message || 'n/a'}`,
      weight: 0.16,
    });
  }
  if (metrics?.errorRate !== undefined) {
    evidence.push({
      signal: 'Service metrics',
      detail: `error rate ${(metrics.errorRate * 100).toFixed(1)}%, p95 ${metrics.p95Ms}ms`,
      weight: metrics.errorRate > 0.05 ? 0.14 : 0.05,
    });
  }
  if (corr?.insufficient) {
    evidence.push({ signal: 'Correlation', detail: 'Insufficient time-series data for correlation.', weight: 0.02 });
  } else if (corr && corr.score != null) {
    evidence.push({
      signal: 'Correlation',
      detail: `${corr.linkage} moves with ${corr.base} at r=${corr.score}.${corr.failureSharePct ? ` ${corr.failureSharePct}% of failures align with that signal.` : ''}`,
      weight: Math.abs(corr.score || 0) >= 0.7 ? 0.24 : 0.08,
    });
  }
  if (security) {
    evidence.push({
      signal: 'Token validation',
      detail: `${security.tokenErrors} token errors, key mismatch ${security.keyMismatch ? 'yes' : 'no'}`,
      weight: security.keyMismatch ? 0.4 : 0.1,
    });
  }
  if (queues.length) {
    evidence.push({
      signal: 'Queue pressure',
      detail: queues.map((item) => `${item.queue} depth ${item.depth}, lag ${Math.round(item.lagMs / 1000)}s`).join('; '),
      weight: queues.some((item) => item.lagMs > 30000) ? 0.35 : 0.1,
    });
  }

  const herrings = changes.filter((change) => change.redHerring);
  const ruledOut = [...(narrative.ruledOut || [])];
  if (herrings.length && corr && !String(corr.linkage).includes('cpu')) {
    ruledOut.unshift({
      hypothesis: `Recent deploy caused the incident (${herrings[0].title})`,
      reason: `The change is present, but the error onset tracks ${corr.linkage} (r=${corr.score}), not the deploy.`,
    });
  }

  let confidence = Math.round(50 + evidence.reduce((sum, item) => sum + item.weight, 0) * 45);
  const strongPool = db?.utilization >= 0.9 && (tx?.byReason?.DB_TIMEOUT || logs?.topErrors?.[0]?.count || 0) > 50 && Math.abs(corr?.score || 0) >= 0.7;
  const strongAuth = security?.keyMismatch && Math.abs(corr?.score || 0) >= 0.5;
  const strongQueue = queue && queue.lagMs > 30000 && Math.abs(corr?.score || 0) >= 0.5;
  const strongProvider = /PROVIDER_RATE_LIMIT|circuit/i.test(JSON.stringify(logs || {})) && Math.abs(corr?.score || 0) >= 0.5;
  const paymentLike = category === 'payments' || category === 'custom' || domains.includes('payments');
  const queueLike = category === 'orders' || category === 'notifications' || category === 'checkout' || domains.includes('orders') || domains.includes('checkout');
  if (paymentLike && strongPool) confidence = Math.min(95, Math.max(90, Math.round(90 + Math.abs(corr.score) * 4)));
  else if ((category === 'authentication' || domains.includes('authentication')) && strongAuth) confidence = Math.min(95, 88 + (Math.abs(corr?.score || 0) >= 0.7 ? 4 : 0));
  else if (queueLike && (strongQueue || strongProvider)) confidence = Math.min(95, 88 + (Math.abs(corr?.score || 0) >= 0.7 ? 3 : 0));
  else if (category === 'inventory' && db && (logs?.errorCount || 0) > 20) confidence = 72;
  else confidence = Math.min(confidence, 64);

  const linked = corr ? `${corr.linkage} (r=${corr.score})` : 'the measured resource';
  const rootCause = strongPool
    ? `payments-db connection pool is exhausted (${db.active}/${db.max}, ${Math.round(db.utilization * 100)}% utilized). Payment failures rose with ${linked}.`
    : narrative.rootCause;

  return {
    rootCause,
    confidence: Math.max(0, Math.min(96, confidence)),
    evidence: evidence.slice(0, 6),
    ruledOut: ruledOut.slice(0, 4),
  };
}
