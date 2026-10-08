import { z } from 'zod';
import { liveSnapshot } from '../simulation/metrics.js';

export const tool = {
  name: 'check_database',
  description: 'Read connection pool utilization, wait queue, slow queries, and timeouts.',
  safety: 'read',
  agentRole: 'Database Analyst',
  appliesTo: ['payments', 'unknown'],
  inputSchema: z.object({ database: z.string().min(1).max(80) }),
  execute(args, world) {
    const db = world.databases[args.database];
    if (!db) throw new Error(`Unknown database ${args.database}`);
    const live = liveSnapshot(world);
    const primary = args.database === world.narrative.primaryDatabase;
    const utilization = primary && world.narrative.baseline.resourceLabel === 'DB utilization'
      ? live.resource
      : db.active / db.max;
    const data = {
      database: args.database,
      utilization,
      active: primary && world.narrative.baseline.resourceLabel === 'DB utilization'
        ? Math.round(utilization * db.max)
        : db.active,
      max: db.max,
      waitQueue: db.waitQueue,
      slowQueries: db.slowQueries,
      latencyMs: db.latencyMs,
      timeouts: db.timeouts,
    };
    return {
      summary: `${args.database} utilization ${(utilization * 100).toFixed(0)}% (${data.active}/${data.max})`,
      data,
      findings: [
        { label: 'Utilization', value: `${(utilization * 100).toFixed(0)}%`, severity: utilization > 0.9 ? 'critical' : 'info' },
        { label: 'Connections', value: `${data.active}/${data.max}`, severity: data.active / data.max > 0.9 ? 'critical' : 'info' },
        { label: 'Timeouts', value: String(db.timeouts), severity: db.timeouts > 10 ? 'critical' : 'info' },
      ],
    };
  },
};
