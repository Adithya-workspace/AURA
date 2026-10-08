import { buildScenario } from './scenarios/index.js';

const RULES = [
  ['payments', /\b(payment|payments|charge|charges|card|upi)\b/i],
  ['checkout', /\bcheckout\b/i],
  ['notifications', /\b(notification|notifications|email|sms)\b/i],
  ['authentication', /\b(authentication|login|sign-?in|jwt|unauthorized)\b/i],
  ['orders', /\b(order|orders|fulfillment)\b/i],
  ['inventory', /\binventory\b/i],
  ['database', /\b(database|postgres|mysql)\b/i],
  ['deployment', /\b(deploy|deployment|release|rollback)\b/i],
  ['analytics', /\b(analytics|dashboard)\b/i],
  ['performance', /\b(slow|latency|timeout)\b/i],
];

export function detectDomains(text = '', service = '') {
  const blob = `${text} ${service}`;
  return RULES.filter(([, pattern]) => pattern.test(blob)).map(([name]) => name);
}

export function openProblems(world) {
  return (world?.problems || []).filter((problem) => problem.status !== 'resolved' && problem.type !== 'unrelated');
}

function shell(scenario, extras) {
  return {
    scenarioKey: null,
    custom: true,
    pacing: extras.pacing,
    partialRecovery: false,
    services: structuredClone(scenario.services),
    databases: structuredClone(scenario.databases),
    queues: structuredClone(scenario.queues),
    logs: structuredClone(scenario.logs),
    transactions: scenario.transactions ? structuredClone(scenario.transactions) : null,
    security: structuredClone(scenario.security),
    changes: structuredClone(scenario.changes),
    series: structuredClone(scenario.series),
    narrative: structuredClone(scenario.narrative),
    plan: structuredClone(scenario.plan),
    title: scenario.title,
    description: scenario.description,
    category: extras.category || scenario.category,
    severity: scenario.severity,
    objective: extras.objective || scenario.objective,
    affectedServices: [...(extras.affectedServices || scenario.affectedServices)],
    domains: extras.domains,
    symptoms: extras.symptoms || [],
    problems: extras.problems || [],
    fixes: extras.fixes || null,
    investigationSteps: extras.steps || null,
    coverSteps: Boolean(extras.coverSteps),
    noTelemetry: Boolean(extras.noTelemetry),
    uploads: [],
    provider: scenario.narrative?.primaryFix?.args?.params?.provider || null,
    clock: { ramp: null, applied: [] },
    verificationBefore: null,
  };
}

function problem(fields) {
  return {
    confidence: 70,
    evidence: [],
    causes: [],
    status: 'open',
    affectedServices: [],
    ...fields,
  };
}

export function createCustomWorld(description, { pacing = 'normal', service = '', now = Date.now() } = {}) {
  const domains = detectDomains(description, service);
  const symptoms = description.split(/[.\n]/).map((part) => part.trim()).filter((part) => part.length > 8).slice(0, 4);

  if (domains.includes('payments')) {
    return compoundPayments(domains, symptoms, { pacing, now, description });
  }
  if (domains.includes('authentication')) return fromScenario('authentication', domains, symptoms, { pacing, now });
  if (domains.includes('orders')) return fromScenario('orders', domains, symptoms, { pacing, now });
  if (domains.includes('notifications')) return fromScenario('notifications', domains, symptoms, { pacing, now });
  if (domains.includes('checkout')) return checkoutOnly(domains, symptoms, { pacing, now });
  if (domains.includes('inventory')) return inventoryWorld(domains, symptoms, { pacing, now });
  if (domains.includes('database')) return databaseWorld(domains, symptoms, { pacing, now });
  if (domains.includes('deployment')) return deploymentWorld(domains, symptoms, { pacing, now });
  return emptyWorld(domains, symptoms, description, { pacing });
}

function fromScenario(key, domains, symptoms, options) {
  const scenario = buildScenario(key, options.now);
  return shell(scenario, {
    pacing: options.pacing,
    domains,
    symptoms,
    problems: [
      problem({
        id: `prob-${key}`,
        title: scenario.narrative.rootCause.slice(0, 120),
        description: scenario.narrative.rootCause,
        severity: scenario.severity,
        confidence: scenario.narrative.confidence,
        type: 'root_cause',
        affectedServices: scenario.affectedServices,
      }),
    ],
  });
}

function compoundPayments(domains, symptoms, { pacing, now, description }) {
  const scenario = buildScenario('payments', now);
  const downstream = domains.includes('checkout') || domains.includes('notifications') || domains.includes('orders');
  const problems = [
    problem({
      id: 'prob-pool',
      title: 'Database connection pool exhaustion',
      description: 'payments-db is holding 98 of 100 connections.',
      severity: 'critical',
      confidence: 90,
      type: 'root_cause',
      affectedServices: ['payments-db'],
    }),
    problem({
      id: 'prob-api',
      title: 'Payment API degradation',
      description: 'Charge requests time out while waiting for a database connection.',
      severity: 'high',
      confidence: 86,
      type: 'downstream',
      affectedServices: ['payment-service'],
      causes: ['prob-pool'],
    }),
  ];
  if (domains.includes('checkout') || domains.includes('orders')) {
    problems.push(problem({
      id: 'prob-checkout',
      title: 'Checkout queue backlog',
      description: 'Checkout workers are stuck behind failed payment attempts.',
      severity: 'medium',
      confidence: 74,
      type: 'downstream',
      affectedServices: ['checkout-service', 'checkout-queue'],
      causes: ['prob-api'],
    }));
  }
  if (domains.includes('notifications')) {
    problems.push(problem({
      id: 'prob-notify',
      title: 'Notification processing delay',
      description: 'Notification dispatch waits on checkout completion.',
      severity: 'medium',
      confidence: 68,
      type: 'downstream',
      affectedServices: ['notification-service', 'email-queue'],
      causes: ['prob-checkout'],
    }));
  }
  problems.push(problem({
    id: 'prob-cpu',
    title: 'Checkout CPU is high but steady',
    description: 'CPU stays near 91% across the whole window and does not move with the error spike.',
    severity: 'low',
    confidence: 40,
    type: 'unrelated',
    affectedServices: ['checkout-service'],
    status: 'open',
  }));

  const fixes = downstream
    ? [
      {
        applied: false,
        effect: 'recover-primary',
        problemIds: ['prob-pool', 'prob-api'],
        proposal: scenario.narrative.primaryFix,
      },
      {
        applied: false,
        effect: 'clear-downstream',
        problemIds: ['prob-checkout', 'prob-notify'],
        proposal: {
          tool: 'apply_remediation',
          args: { action: 'scale_workers', params: { queue: 'checkout-queue', workers: 6 } },
          title: 'Scale checkout workers to drain the backlog',
          rationale: 'The payment path recovered, but checkout is still behind and notifications are waiting on it.',
          expectedImpact: 'Checkout lag and the notification queue should fall back to a few seconds.',
          risk: 'low',
        },
      },
    ]
    : null;

  const steps = [
    { tool: 'analyze_logs', args: { service: 'payment-service', timeframe: '30m' }, why: 'Payment errors should show up in the service log first.' },
    { tool: 'get_service_metrics', args: { service: 'payment-service' }, why: 'Quantify error rate and latency before blaming a dependency.' },
    { tool: 'analyze_transactions', args: { timeframe: '30m' }, why: 'Separate database timeouts from other charge failures.' },
    { tool: 'check_database', args: { database: 'payments-db' }, why: 'The timeouts point at the connection pool.' },
    { tool: 'check_queue', args: { queue: 'checkout-queue' }, why: 'Checkout was named in the report, so measure that queue directly.' },
    { tool: 'check_queue', args: { queue: 'email-queue' }, why: 'Delayed notifications need their own queue reading.' },
    { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'Check whether a recent deploy explains the spike.' },
    { tool: 'correlate_errors', args: { signals: ['db_utilization', 'db_timeouts', 'latency_ms', 'checkout_cpu'] }, why: 'Test which signal actually moves with payment failures.' },
  ].filter((step) => {
    if (step.args.queue === 'checkout-queue') return domains.includes('checkout') || domains.includes('orders');
    if (step.args.queue === 'email-queue') return domains.includes('notifications');
    return true;
  });

  const world = shell(scenario, {
    pacing,
    category: 'custom',
    domains,
    symptoms,
    problems,
    fixes,
    steps,
    coverSteps: true,
    objective: 'Investigate every symptom in the report, separate the primary cause from downstream effects, and resolve what the tools can safely change.',
    affectedServices: ['payment-service', 'payments-db', ...(domains.includes('checkout') || domains.includes('orders') ? ['checkout-service'] : []), ...(domains.includes('notifications') ? ['notification-service'] : [])],
  });
  world.description = description;
  if (domains.includes('checkout') || domains.includes('orders')) {
    world.queues['checkout-queue'] = { depth: 860, consumers: 2, lagMs: 180000, oldestAgeSec: 640 };
    world.logs['checkout-service'] = {
      eventCount: 4200,
      errorCount: 188,
      topErrors: [{ message: 'QUEUE_LAG: checkout-queue consumers blocked on payment timeouts', count: 150 }],
      samples: ['checkout-service WARN QUEUE_LAG checkout-queue lag=180s'],
    };
  }
  if (domains.includes('notifications')) {
    world.queues['email-queue'] = { depth: 540, consumers: 2, lagMs: 150000, oldestAgeSec: 500 };
    world.logs['notification-service'] = {
      eventCount: 2100,
      errorCount: 96,
      topErrors: [{ message: 'NOTIFY_DELAY: waiting on checkout completion', count: 90 }],
      samples: ['notification-service WARN NOTIFY_DELAY waiting on checkout'],
    };
  }
  world.narrative.rootCause = downstream
    ? 'payments-db connection pool exhaustion is the primary cause. Payment API errors, checkout backlog, and notification delay follow from it.'
    : scenario.narrative.rootCause;
  return world;
}

function checkoutOnly(domains, symptoms, { pacing, now }) {
  const scenario = buildScenario('orders', now);
  const queue = scenario.queues['orders-queue'];
  scenario.queues['checkout-queue'] = structuredClone(queue);
  delete scenario.queues['orders-queue'];
  scenario.narrative.primaryQueue = 'checkout-queue';
  scenario.narrative.primaryFix.args.params.queue = 'checkout-queue';
  if (scenario.narrative.secondFix?.args?.params?.queue) scenario.narrative.secondFix.args.params.queue = 'checkout-queue';
  scenario.logs['checkout-service'] = scenario.logs['order-service'];
  scenario.services['checkout-service'] = scenario.services['order-service'];
  scenario.category = 'checkout';
  scenario.affectedServices = ['checkout-service', 'checkout-queue'];
  const steps = [
    { tool: 'check_queue', args: { queue: 'checkout-queue' }, why: 'Slow checkout usually shows up as queue lag.' },
    { tool: 'analyze_logs', args: { service: 'checkout-service', timeframe: '30m' }, why: 'Read the checkout log before changing workers.' },
    { tool: 'get_service_metrics', args: { service: 'checkout-service' }, why: 'See whether the service itself is saturated.' },
    { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'Check recent changes against the lag onset.' },
    { tool: 'correlate_errors', args: { signals: ['queue_lag', 'latency_ms', 'catalog_cpu'] }, why: 'Test whether queue lag tracks the errors.' },
  ];
  return shell(scenario, {
    pacing,
    now,
    domains,
    symptoms,
    category: 'checkout',
    steps,
    coverSteps: true,
    problems: [
      problem({
        id: 'prob-checkout',
        title: 'Checkout queue backlog',
        description: scenario.narrative.rootCause,
        severity: 'high',
        type: 'root_cause',
        affectedServices: ['checkout-service', 'checkout-queue'],
      }),
    ],
  });
}

function inventoryWorld(domains, symptoms, { pacing, now }) {
  const scenario = buildScenario('payments', now);
  scenario.category = 'inventory';
  scenario.services = {
    'inventory-service': { rps: 40, cpu: 0.38, memory: 0.44, failingEndpoints: ['GET /v1/stock'] },
  };
  scenario.databases = {
    'inventory-db': { active: 40, max: 50, waitQueue: 12, slowQueries: 33, latencyMs: 960, timeouts: 28 },
  };
  scenario.queues = {};
  scenario.transactions = null;
  scenario.logs = {
    'inventory-service': {
      eventCount: 1800,
      errorCount: 74,
      topErrors: [{ message: 'HTTP 500 intermittent stock read', count: 61 }],
      samples: ['inventory-service ERROR 500 GET /v1/stock'],
    },
  };
  scenario.series = {
    error_rate: scenario.series.error_rate.map((value) => value * 0.4),
    latency_ms: scenario.series.latency_ms.map((value) => Math.min(value, 1200)),
  };
  scenario.narrative = {
    ...scenario.narrative,
    primaryService: 'inventory-service',
    primaryDatabase: 'inventory-db',
    primaryQueue: null,
    baseline: { errorRate: 0.041, latencyMs: 960, resource: 0.8, resourceLabel: 'DB utilization', resourceThreshold: 0.75, serviceStatus: 'DEGRADED' },
    partial: { errorRate: 0.02, latencyMs: 500, resource: 0.55 },
    full: { errorRate: 0.008, latencyMs: 240, resource: 0.4 },
    rootCause: 'inventory-db slow queries are producing intermittent HTTP 500s on stock reads.',
    confidence: 72,
    primaryFix: {
      tool: 'apply_remediation',
      args: { action: 'restart_service', params: { service: 'inventory-service' } },
      title: 'Restart inventory-service',
      rationale: 'The stock endpoint is throwing intermittent 500s tied to slow inventory-db reads.',
      expectedImpact: 'Clears stuck readers so stock reads succeed again.',
      risk: 'medium',
    },
    secondFix: null,
    safeAlternative: null,
  };
  scenario.changes = [{ id: 'chg_inv', service: 'inventory-service', type: 'deploy', title: 'stock cache tweak', at: now - 3600000, redHerring: true, note: 'Error rate did not move at deploy time' }];
  scenario.plan = [
    { id: 'i1', title: 'Read inventory-service logs', toolHint: 'analyze_logs' },
    { id: 'i2', title: 'Check inventory-db', toolHint: 'check_database' },
    { id: 'i3', title: 'Review recent changes', toolHint: 'get_recent_changes' },
  ];
  return shell(scenario, {
    pacing,
    domains,
    symptoms,
    category: 'inventory',
    affectedServices: ['inventory-service', 'inventory-db'],
    steps: [
      { tool: 'analyze_logs', args: { service: 'inventory-service', timeframe: '30m' }, why: 'Intermittent 500s should be in the inventory log.' },
      { tool: 'check_api_health', args: { service: 'inventory-service' }, why: 'Confirm the stock endpoint is the one failing.' },
      { tool: 'check_database', args: { database: 'inventory-db' }, why: 'Slow stock reads often come from the inventory database.' },
      { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'See whether a deploy lines up with the 500s.' },
      { tool: 'correlate_errors', args: { signals: ['latency_ms', 'error_rate'] }, why: 'Only correlate signals that this service actually records.' },
    ],
    coverSteps: true,
    problems: [
      problem({
        id: 'prob-inventory',
        title: 'Inventory stock reads failing',
        description: 'GET /v1/stock returns intermittent 500s while inventory-db queries are slow.',
        severity: 'high',
        type: 'root_cause',
        affectedServices: ['inventory-service', 'inventory-db'],
      }),
    ],
  });
}

function databaseWorld(domains, symptoms, { pacing, now }) {
  const scenario = buildScenario('payments', now);
  scenario.databases['payments-db'] = { active: 62, max: 100, waitQueue: 4, slowQueries: 22, latencyMs: 740, timeouts: 11 };
  scenario.narrative.baseline = { errorRate: 0.03, latencyMs: 740, resource: 0.62, resourceLabel: 'DB utilization', resourceThreshold: 0.75, serviceStatus: 'DEGRADED' };
  scenario.narrative.full = { errorRate: 0.02, latencyMs: 400, resource: 0.5 };
  scenario.narrative.rootCause = 'payments-db latency is elevated, but utilization is 62% and there is no timeout spike strong enough to name a single cause.';
  scenario.narrative.confidence = 48;
  scenario.narrative.primaryFix = null;
  scenario.narrative.secondFix = null;
  scenario.logs['payment-service'].errorCount = 40;
  scenario.logs['payment-service'].topErrors = [{ message: 'slow query on payments-db', count: 18 }];
  const rising = Array.from({ length: 20 }, (_, index) => (index < 10 ? 0 : 1));
  scenario.series = {
    error_rate: rising.map((flag) => (flag ? 0.03 : 0.012)),
    db_utilization: rising.map(() => 0.62),
    latency_ms: rising.map((flag) => (flag ? 740 : 200)),
    db_timeouts: rising.map((flag) => (flag ? 2 : 0)),
  };
  return shell(scenario, {
    pacing,
    domains,
    symptoms,
    category: 'database',
    objective: 'Measure the connected database and say so if the signal is too weak to act.',
    steps: [
      { tool: 'check_database', args: { database: 'payments-db' }, why: 'The report names the database, and payments-db is the connected instance.' },
      { tool: 'analyze_logs', args: { service: 'payment-service', timeframe: '30m' }, why: 'Look for timeout evidence before proposing a pool change.' },
      { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'A schema change would matter more than a hunch.' },
      { tool: 'correlate_errors', args: { signals: ['db_utilization', 'latency_ms', 'db_timeouts'] }, why: 'See whether latency, utilization, and timeouts actually move together.' },
    ],
    coverSteps: true,
    problems: [
      problem({
        id: 'prob-db',
        title: 'Database latency is elevated',
        description: 'Connected database latency is above baseline. The pool is not exhausted.',
        severity: 'medium',
        confidence: 48,
        type: 'root_cause',
        affectedServices: ['payments-db'],
      }),
    ],
  });
}

function deploymentWorld(domains, symptoms, { pacing, now }) {
  const scenario = buildScenario('payments', now);
  scenario.services['payment-service'].failingEndpoints = [];
  scenario.databases['payments-db'] = { active: 41, max: 100, waitQueue: 0, slowQueries: 1, latencyMs: 180, timeouts: 0 };
  scenario.narrative.baseline = { errorRate: 0.012, latencyMs: 280, resource: 0.41, resourceLabel: 'DB utilization', resourceThreshold: 0.75, serviceStatus: 'HEALTHY' };
  scenario.narrative.full = { errorRate: 0.012, latencyMs: 280, resource: 0.41 };
  scenario.narrative.rootCause = 'A deploy is recorded, but error rate and database utilization did not move with it. The deploy is not corroborated as the cause.';
  scenario.narrative.confidence = 34;
  scenario.narrative.primaryFix = null;
  scenario.narrative.secondFix = null;
  scenario.logs['payment-service'] = {
    eventCount: 8000,
    errorCount: 12,
    topErrors: [{ message: 'INFO deploy v2.4.1 complete', count: 1 }],
    samples: ['payment-service INFO deploy v2.4.1 complete'],
  };
  scenario.transactions = { total: 900, failed: 11, byReason: { OTHER: 11 }, byMethod: { card: 6 } };
  scenario.series = {
    error_rate: Array.from({ length: 20 }, () => 0.012),
    db_utilization: Array.from({ length: 20 }, () => 0.41),
    latency_ms: Array.from({ length: 20 }, () => 280),
    checkout_cpu: Array.from({ length: 20 }, () => 0.5),
    db_timeouts: Array.from({ length: 20 }, () => 0),
  };
  return shell(scenario, {
    pacing,
    domains,
    symptoms,
    category: 'deployment',
    objective: 'Test the deploy against live error and resource signals. Do not assume it is causal.',
    steps: [
      { tool: 'get_recent_changes', args: { timeframe: '24h' }, why: 'Record the deploy before judging it.' },
      { tool: 'get_service_metrics', args: { service: 'payment-service' }, why: 'A causal deploy should show an error or latency shift.' },
      { tool: 'analyze_logs', args: { service: 'payment-service', timeframe: '30m' }, why: 'Logs show whether errors changed after the release.' },
      { tool: 'correlate_errors', args: { signals: ['db_utilization', 'latency_ms', 'checkout_cpu'] }, why: 'Compare the deploy window with the signals that actually moved.' },
    ],
    coverSteps: true,
    problems: [],
  });
}

function emptyWorld(domains, symptoms, description, { pacing }) {
  const named = domains.filter((domain) => domain === 'analytics').join(', ');
  const note = named
    ? `No telemetry is connected for ${named}.`
    : 'No connected service matches this report.';
  return {
    scenarioKey: null,
    custom: true,
    pacing,
    partialRecovery: false,
    services: {},
    databases: {},
    queues: {},
    logs: {},
    transactions: null,
    security: { authFailures: 0, tokenErrors: 0, keyMismatch: false },
    changes: [],
    series: {},
    narrative: {
      baseline: { errorRate: 0, latencyMs: 0, resource: 0, resourceLabel: 'n/a', resourceThreshold: 1, serviceStatus: 'UNKNOWN' },
      partial: { errorRate: 0, latencyMs: 0, resource: 0 },
      full: { errorRate: 0, latencyMs: 0, resource: 0 },
      rootCause: `${note} Insufficient telemetry available to confidently determine the root cause.`,
      confidence: 15,
      evidence: [{ signal: 'Telemetry', detail: note, weight: 1 }],
      ruledOut: [],
      primaryFix: null,
      secondFix: null,
      safeAlternative: null,
      timeoutShare: 0,
    },
    plan: [{ id: 'c1', title: 'Stop when no connected telemetry matches', toolHint: 'analyze' }],
    title: description.slice(0, 80),
    description,
    category: domains[0] || 'custom',
    severity: 'medium',
    objective: 'Investigate only with connected telemetry or uploaded evidence, and escalate when that is not enough.',
    affectedServices: [],
    domains,
    symptoms,
    problems: [],
    fixes: null,
    investigationSteps: [],
    coverSteps: false,
    noTelemetry: true,
    uploads: [],
    provider: null,
    clock: { ramp: null, applied: [] },
    verificationBefore: null,
  };
}
