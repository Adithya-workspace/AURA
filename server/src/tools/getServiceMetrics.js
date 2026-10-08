import { z } from 'zod';
import { liveSnapshot } from '../simulation/metrics.js';

export const tool = {
  name: 'get_service_metrics',
  description: 'Read request rate, error rate, p95 latency, CPU, and memory for a service.',
  safety: 'read',
  agentRole: 'Infrastructure Analyst',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  inputSchema: z.object({ service: z.string().min(1).max(80) }),
  execute(args, world) {
    const base = world.services[args.service];
    if (!base) throw new Error(`Unknown service ${args.service}`);
    const live = liveSnapshot(world);
    const primary = args.service === world.narrative.primaryService;
    const errorRate = primary ? live.errorRate : 0.004;
    const p95 = primary ? live.latencyMs : 180;
    const data = {
      service: args.service,
      rps: base.rps,
      errorRate,
      p95Ms: Math.round(p95),
      cpu: base.cpu,
      memory: base.memory,
    };
    return {
      summary: `${args.service} error ${(errorRate * 100).toFixed(1)}%, p95 ${data.p95Ms}ms, CPU ${Math.round(base.cpu * 100)}%`,
      data,
      findings: [
        { label: 'Error rate', value: `${(errorRate * 100).toFixed(1)}%`, severity: errorRate > 0.05 ? 'critical' : 'info' },
        { label: 'p95 latency', value: `${data.p95Ms}ms`, severity: data.p95Ms > 1000 ? 'critical' : 'info' },
        { label: 'CPU', value: `${Math.round(base.cpu * 100)}%`, severity: base.cpu > 0.85 ? 'warning' : 'info' },
      ],
    };
  },
};
