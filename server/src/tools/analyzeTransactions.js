import { z } from 'zod';
import { liveSnapshot } from '../simulation/metrics.js';

export const tool = {
  name: 'analyze_transactions',
  description: 'Break down payment failure rate by reason and payment method.',
  safety: 'read',
  agentRole: 'Database Analyst',
  appliesTo: ['payments'],
  inputSchema: z.object({ timeframe: z.string().min(1).max(16).default('30m') }),
  execute(args, world) {
    if (!world.transactions) throw new Error('No transaction ledger on this service');
    const live = liveSnapshot(world);
    const failed = Math.round(world.transactions.total * live.errorRate);
    const data = {
      timeframe: args.timeframe,
      total: world.transactions.total,
      failed,
      failureRate: live.errorRate,
      byReason: world.transactions.byReason,
      byMethod: world.transactions.byMethod,
    };
    return {
      summary: `${(live.errorRate * 100).toFixed(1)}% of ${data.total} charges failed`,
      data,
      findings: [
        { label: 'Failure rate', value: `${(live.errorRate * 100).toFixed(1)}%`, severity: 'critical' },
        { label: 'DB timeouts', value: String(world.transactions.byReason.DB_TIMEOUT || 0), severity: 'critical' },
        { label: 'Card failures', value: String(world.transactions.byMethod.card || 0), severity: 'warning' },
      ],
    };
  },
};
