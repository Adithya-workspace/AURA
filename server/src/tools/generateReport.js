import { z } from 'zod';

export const tool = {
  name: 'generate_report',
  description: 'Build the incident report from persisted events, actions, and verification.',
  safety: 'read',
  agentRole: 'Root Cause Analyst',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  phase: 'report',
  inputSchema: z.object({ incidentId: z.string().min(1) }),
  execute(args, world) {
    return {
      summary: `Report requested for ${args.incidentId}`,
      data: { incidentId: args.incidentId, scenarioKey: world?.scenarioKey || null },
      findings: [{ label: 'Report', value: 'compiled from the incident record', severity: 'info' }],
    };
  },
};
