import { z } from 'zod';
import { deltas, judgeVerdict, liveSnapshot } from '../simulation/metrics.js';
import { openProblems } from '../simulation/customWorld.js';
import { tool as healthTool } from './checkApiHealth.js';
import { tool as metricsTool } from './getServiceMetrics.js';
import { tool as dbTool } from './checkDatabase.js';
import { tool as queueTool } from './checkQueue.js';

export const tool = {
  name: 'verify_recovery',
  description: 'Re-read health, metrics, and the key resource, then compare them with the before snapshot.',
  safety: 'read',
  agentRole: 'Verification Agent',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  phase: 'verify',
  inputSchema: z.object({ incidentId: z.string().min(1) }),
  execute(args, world) {
    const health = healthTool.execute({ service: world.narrative.primaryService }, world);
    const metrics = metricsTool.execute({ service: world.narrative.primaryService }, world);
    let resourceCheck = null;
    if (world.narrative.baseline.resourceLabel === 'DB utilization') {
      resourceCheck = dbTool.execute({ database: world.narrative.primaryDatabase }, world);
    } else if (world.narrative.baseline.resourceLabel.startsWith('Queue')) {
      resourceCheck = queueTool.execute({ queue: world.narrative.primaryQueue }, world);
    }
    const before = world.verificationBefore || world.narrative.baseline;
    const after = liveSnapshot(world);
    let verdict = judgeVerdict(before, after);
    const healthy = after.errorRate < 0.03 && after.resource < (after.resourceThreshold ?? 1);
    if (healthy && openProblems(world).length === 0) verdict = 'CONFIRMED';
    const data = {
      incidentId: args.incidentId,
      before,
      after,
      deltas: deltas(before, after),
      verdict,
      health: health.data,
      metrics: metrics.data,
      resourceCheck: resourceCheck?.data || null,
    };
    return {
      summary: `Verification ${verdict}`,
      data,
      findings: [
        { label: 'Verdict', value: verdict, severity: verdict === 'CONFIRMED' ? 'info' : 'warning' },
        { label: 'Error rate', value: `${(before.errorRate * 100).toFixed(1)}% → ${(after.errorRate * 100).toFixed(1)}%`, severity: 'info' },
        { label: 'Latency', value: `${Math.round(before.latencyMs)}ms → ${Math.round(after.latencyMs)}ms`, severity: 'info' },
      ],
    };
  },
};
