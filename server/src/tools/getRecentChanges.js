import { z } from 'zod';

export const tool = {
  name: 'get_recent_changes',
  description: 'List recent deploys and config changes, including unrelated changes.',
  safety: 'read',
  agentRole: 'Infrastructure Analyst',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  inputSchema: z.object({ timeframe: z.string().min(1).max(16).default('24h') }),
  execute(args, world) {
    const data = { timeframe: args.timeframe, changes: world.changes };
    const top = world.changes[0];
    return {
      summary: `${world.changes.length} changes in ${args.timeframe}. Latest: ${top?.title || 'none'}`,
      data,
      findings: world.changes.slice(0, 3).map((change) => ({
        label: change.redHerring ? 'Unrelated change' : 'Change',
        value: `${change.service}: ${change.title}`,
        severity: change.redHerring ? 'info' : 'warning',
      })),
    };
  },
};
