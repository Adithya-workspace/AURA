export const STAGES = [
  { id: 'received', label: 'Incident Received' },
  { id: 'understand', label: 'Understanding' },
  { id: 'plan', label: 'Plan Generated' },
  { id: 'investigate', label: 'Investigating' },
  { id: 'discover', label: 'Problem Discovery' },
  { id: 'analyze', label: 'Root Cause Analysis' },
  { id: 'approval', label: 'Remediation' },
  { id: 'verify', label: 'Verification' },
  { id: 'report', label: 'Resolved' },
];

export function initialView() {
  return {
    stages: STAGES.map((stage) => ({ ...stage, status: 'pending' })),
    plan: [],
    tools: [],
    rootCause: null,
    confidence: null,
    evidence: [],
    ruledOut: [],
    approval: null,
    approvals: [],
    execution: [],
    verification: null,
    metrics: null,
    activity: [],
    report: null,
    objective: '',
    affectedServices: [],
    category: null,
    severity: null,
    symptoms: [],
    domains: [],
    problems: [],
    remediationPlan: [],
    status: 'idle',
    error: null,
    adapting: null,
  };
}

function activate(stages, id) {
  const index = stages.findIndex((stage) => stage.id === id);
  if (index < 0) return stages;
  return stages.map((stage, item) => {
    if (item < index) return { ...stage, status: stage.status === 'failed' ? 'failed' : 'done' };
    if (stage.id === id) return { ...stage, status: 'active' };
    return stage.status === 'active' ? { ...stage, status: 'pending' } : stage;
  });
}

function activityOf(event) {
  return {
    id: event.id || `${event.seq}`,
    seq: event.seq,
    ts: event.ts,
    stage: event.stage,
    role: event.agentRole,
    message: event.payload?.message || event.type.replaceAll('_', ' '),
  };
}

export function applyEvent(state, event) {
  const next = {
    ...state,
    stages: state.stages.map((stage) => ({ ...stage })),
    plan: state.plan.map((item) => ({ ...item })),
    tools: state.tools.map((tool) => ({ ...tool })),
    activity: [...state.activity, activityOf(event)],
    approvals: [...state.approvals],
    execution: [...state.execution],
  };
  const payload = event.payload || {};

  if (event.type === 'incident_received') {
    next.stages = activate(next.stages, 'received');
    next.stages = next.stages.map((stage) => (stage.id === 'received' ? { ...stage, status: 'done' } : stage));
    next.stages = activate(next.stages, 'understand');
    next.status = 'investigating';
  }
  if (event.type === 'understanding_started') next.stages = activate(next.stages, 'understand');
  if (event.type === 'plan_created') {
    next.plan = (payload.plan || []).map((item) => ({ ...item, done: false }));
    next.objective = payload.objective || '';
    next.affectedServices = payload.affectedServices || [];
    next.category = payload.category;
    next.severity = payload.severity;
    next.symptoms = payload.symptoms || [];
    next.domains = payload.suspectedDomains || [];
    next.stages = activate(next.stages, 'plan');
    next.stages = next.stages.map((stage) => (stage.id === 'plan' ? { ...stage, status: 'done' } : stage));
    next.stages = activate(next.stages, 'investigate');
  }
  if (event.type === 'tool_started') {
    next.tools.push({
      id: `${event.seq}`,
      tool: payload.tool,
      args: payload.args,
      why: payload.why,
      role: event.agentRole,
      safety: payload.safety,
      status: 'running',
      findings: [],
    });
    if (event.stage === 'investigate' || !event.stage) next.stages = activate(next.stages, 'investigate');
  }
  if (event.type === 'tool_completed' || event.type === 'tool_failed') {
    const tool = [...next.tools].reverse().find((item) => item.tool === payload.tool && item.status === 'running');
    if (tool) {
      tool.status = event.type === 'tool_completed' ? 'completed' : 'failed';
      tool.durationMs = payload.durationMs;
      tool.summary = payload.summary;
      tool.findings = payload.findings || [];
      tool.data = payload.data;
      tool.error = payload.error;
    }
    next.plan = next.plan.map((item) => (item.toolHint === payload.tool ? { ...item, done: true } : item));
    if (payload.data && (
      payload.data.errorRate !== undefined
      || payload.data.failureRate !== undefined
      || payload.data.utilization !== undefined
      || payload.data.p95Ms !== undefined
    )) {
      const resourceLabel = payload.data.utilization !== undefined
        ? 'DB utilization'
        : next.metrics?.resourceLabel;
      next.metrics = {
        ...(next.metrics || {}),
        errorRate: payload.data.errorRate ?? payload.data.failureRate ?? next.metrics?.errorRate,
        latencyMs: payload.data.p95Ms ?? next.metrics?.latencyMs,
        resource: payload.data.utilization ?? next.metrics?.resource,
        resourceLabel,
      };
    }
  }
  if (event.type === 'problem_discovered') {
    next.problems = [...(next.problems || []), payload];
    next.stages = activate(next.stages, 'discover');
    next.status = 'problems_discovered';
  }
  if (event.type === 'problem_updated') {
    next.problems = (next.problems || []).map((problem) => (problem.id === payload.id ? { ...problem, ...payload } : problem));
  }
  if (event.type === 'remediation_plan') {
    next.remediationPlan = payload.plan || [];
  }
  if (event.type === 'root_cause_identified') {
    const followUp = String(payload.rootCause || '').startsWith('Primary fault improved');
    if (!followUp || !next.rootCause) {
      next.rootCause = payload.rootCause;
      next.confidence = payload.confidence;
      next.evidence = payload.evidence || [];
      next.ruledOut = payload.ruledOut || [];
    }
    next.stages = activate(next.stages, 'analyze');
    next.stages = next.stages.map((stage) => (stage.id === 'analyze' ? { ...stage, status: 'done' } : stage));
    next.stages = activate(next.stages, 'approval');
    next.plan = next.plan.map((item) => (item.toolHint === 'analyze' ? { ...item, done: true } : item));
  }
  if (event.type === 'approval_required') {
    next.approval = { ...payload, state: 'pending' };
    next.approvals.push(next.approval);
    next.stages = activate(next.stages, 'approval');
    next.status = 'awaiting_approval';
  }
  if (event.type === 'approval_granted') {
    if (next.approval?.remediationId === payload.remediationId) next.approval = { ...next.approval, state: 'approved' };
    next.status = 'remediating';
  }
  if (event.type === 'approval_rejected') {
    if (next.approval?.remediationId === payload.remediationId) next.approval = { ...next.approval, state: 'rejected' };
  }
  if (event.type === 'action_started') {
    next.execution = [];
    next.stages = activate(next.stages, 'approval');
  }
  if (event.type === 'action_progress') {
    next.execution.push({ step: payload.step, done: true });
    if (payload.metrics) next.metrics = payload.metrics;
    next.plan = next.plan.map((item) => (item.toolHint === 'apply_remediation' ? { ...item, done: true } : item));
  }
  if (event.type === 'action_completed') next.stages = activate(next.stages, 'verify');
  if (event.type === 'verification_started') next.stages = activate(next.stages, 'verify');
  if (event.type === 'verification_completed') {
    next.verification = payload;
    next.metrics = payload.after || next.metrics;
    next.stages = next.stages.map((stage) => (stage.id === 'verify' ? { ...stage, status: 'done' } : stage));
  }
  if (event.type === 'adaptation_started') {
    next.adapting = { reason: payload.reason || payload.message, status: 'adapting' };
    if (!next.stages.some((stage) => stage.id === 'adapt')) {
      const report = next.stages.findIndex((stage) => stage.id === 'report');
      next.stages.splice(report, 0, { id: 'adapt', label: 'Adapting', status: 'adapting' });
    } else {
      next.stages = next.stages.map((stage) => (stage.id === 'adapt' ? { ...stage, status: 'adapting' } : stage));
    }
    next.status = 'investigating';
  }
  if (event.type === 'safety_blocked') {
    next.activity[next.activity.length - 1].message = payload.reason || 'Safety check blocked a tool';
  }
  if (event.type === 'incident_resolved' || event.type === 'incident_escalated') {
    next.report = payload.report || null;
    next.markdown = payload.markdown || '';
    next.status = payload.status || (event.type === 'incident_resolved' ? 'resolved' : 'escalated');
    next.stages = next.stages.map((stage) => {
      if (stage.id === 'report') return { ...stage, status: event.type === 'incident_resolved' ? 'done' : 'failed' };
      if (stage.status === 'active' || stage.status === 'adapting') return { ...stage, status: 'done' };
      return stage;
    });
  }
  if (event.type === 'run_failed') {
    next.error = payload.message || 'The run failed';
    next.status = 'escalated';
  }
  return next;
}

export function reduceEvents(events) {
  return (events || []).reduce(applyEvent, initialView());
}
