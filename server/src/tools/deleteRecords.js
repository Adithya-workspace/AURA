import { z } from 'zod';

export const tool = {
  name: 'delete_records',
  description: 'Delete customer or ledger records. Destructive operations are disabled.',
  safety: 'destructive',
  agentRole: 'Remediation Agent',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  inputSchema: z.object({
    table: z.string().min(1).max(80).optional(),
    confirm: z.boolean().optional(),
  }),
  execute() {
    throw new Error('Destructive tools are disabled');
  },
};
