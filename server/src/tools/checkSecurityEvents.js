import { z } from 'zod';

export const tool = {
  name: 'check_security_events',
  description: 'Read authentication failures, token validation errors, and signing-key mismatch signals.',
  safety: 'read',
  agentRole: 'Log Analyst',
  appliesTo: ['authentication'],
  inputSchema: z.object({ timeframe: z.string().min(1).max(16).default('30m') }),
  execute(args, world) {
    const data = { timeframe: args.timeframe, ...world.security };
    return {
      summary: `${data.authFailures} auth failures, ${data.tokenErrors} token errors, key mismatch ${data.keyMismatch}`,
      data,
      findings: [
        { label: 'Auth failures', value: String(data.authFailures), severity: data.authFailures > 50 ? 'critical' : 'info' },
        { label: 'Token errors', value: String(data.tokenErrors), severity: data.tokenErrors > 20 ? 'critical' : 'info' },
        { label: 'Key mismatch', value: data.keyMismatch ? 'yes' : 'no', severity: data.keyMismatch ? 'critical' : 'info' },
      ],
    };
  },
};
