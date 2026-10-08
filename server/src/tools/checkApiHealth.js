import { z } from 'zod';
import { liveSnapshot } from '../simulation/metrics.js';

export const tool = {
  name: 'check_api_health',
  description: 'Check whether a service is HEALTHY, DEGRADED, or DOWN and which endpoints are failing.',
  safety: 'read',
  agentRole: 'Infrastructure Analyst',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  inputSchema: z.object({ service: z.string().min(1).max(80) }),
  execute(args, world) {
    const base = world.services[args.service];
    if (!base) throw new Error(`Unknown service ${args.service}`);
    const live = liveSnapshot(world);
    const primary = args.service === world.narrative.primaryService;
    const status = primary ? (live.serviceStatus || 'DEGRADED') : 'HEALTHY';
    const latency = primary ? Math.round(live.latencyMs) : 140;
    const data = { service: args.service, status, latencyMs: latency, failingEndpoints: status === 'HEALTHY' ? [] : base.failingEndpoints };
    return {
      summary: `${args.service} is ${status} at ${latency}ms`,
      data,
      findings: [
        { label: 'Status', value: status, severity: status === 'HEALTHY' ? 'info' : 'critical' },
        { label: 'Latency', value: `${latency}ms`, severity: latency > 1000 ? 'warning' : 'info' },
        { label: 'Failing endpoints', value: data.failingEndpoints.join(', ') || 'none', severity: data.failingEndpoints.length ? 'critical' : 'info' },
      ],
    };
  },
};
