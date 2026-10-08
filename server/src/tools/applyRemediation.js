import { z } from 'zod';
import { applyWorldRemediation } from '../simulation/world.js';

const actions = z.enum([
  'update_db_pool_size',
  'restart_service',
  'scale_workers',
  'rollback_config',
  'switch_provider',
  'update_rate_limit',
]);

export const tool = {
  name: 'apply_remediation',
  description: 'Mutate simulated infrastructure. Requires a matching approved remediation record.',
  safety: 'write',
  agentRole: 'Remediation Agent',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  inputSchema: z.object({
    action: actions,
    params: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  }),
  execute(args, world) {
    const result = applyWorldRemediation(world, args.action, args.params || {});
    return {
      summary: result.summary,
      data: { action: args.action, params: args.params, strength: result.strength, steps: result.steps },
      findings: result.steps.map((step) => ({ label: 'Step', value: step, severity: 'info' })),
    };
  },
};
