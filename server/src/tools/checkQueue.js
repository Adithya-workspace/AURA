import { z } from 'zod';
import { liveSnapshot } from '../simulation/metrics.js';

export const tool = {
  name: 'check_queue',
  description: 'Read queue depth, consumer count, lag, and oldest message age.',
  safety: 'read',
  agentRole: 'Infrastructure Analyst',
  appliesTo: ['orders', 'notifications'],
  inputSchema: z.object({ queue: z.string().min(1).max(80) }),
  execute(args, world) {
    const queue = world.queues[args.queue];
    if (!queue) throw new Error(`Unknown queue ${args.queue}`);
    const live = liveSnapshot(world);
    const primary = args.queue === world.narrative.primaryQueue;
    const lagSec = primary && world.narrative.baseline.resourceLabel.startsWith('Queue')
      ? live.resource
      : queue.lagMs / 1000;
    const data = {
      queue: args.queue,
      depth: queue.depth,
      consumers: queue.consumers,
      lagMs: Math.round(lagSec * 1000),
      oldestAgeSec: queue.oldestAgeSec,
    };
    return {
      summary: `${args.queue} depth ${queue.depth}, ${queue.consumers} consumers, lag ${Math.round(lagSec)}s`,
      data,
      findings: [
        { label: 'Depth', value: String(queue.depth), severity: queue.depth > 100 ? 'warning' : 'info' },
        { label: 'Consumers', value: String(queue.consumers), severity: queue.consumers < 3 ? 'warning' : 'info' },
        { label: 'Lag', value: `${Math.round(lagSec)}s`, severity: lagSec > 30 ? 'critical' : 'info' },
      ],
    };
  },
};
