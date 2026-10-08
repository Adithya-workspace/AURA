import { z } from 'zod';
import { pearson } from '../simulation/timeseries.js';

export const tool = {
  name: 'correlate_errors',
  description: 'Compute Pearson correlation between the error timeline and other resource timelines.',
  safety: 'read',
  agentRole: 'Root Cause Analyst',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  inputSchema: z.object({
    signals: z.array(z.string().min(1).max(64)).min(1).max(8),
  }),
  execute(args, world) {
    const available = Object.keys(world.series || {});
    const baseKey = available.includes('error_rate') ? 'error_rate' : available[0];
    const base = baseKey ? world.series[baseKey] : null;
    if (!base || base.length < 3) {
      return {
        summary: 'Insufficient time-series data for correlation.',
        data: { base: baseKey || null, scores: {}, linkage: null, score: null, insufficient: true },
        findings: [{ label: 'Correlation', value: 'Insufficient time-series data', severity: 'warning' }],
      };
    }
    const scores = {};
    for (const signal of args.signals) {
      if (!world.series[signal] || signal === baseKey) continue;
      scores[signal] = Number(pearson(base, world.series[signal]).toFixed(3));
    }
    const ranked = Object.entries(scores).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (!ranked.length) {
      return {
        summary: 'Insufficient time-series data for correlation.',
        data: { base: baseKey, scores, linkage: null, score: null, insufficient: true },
        findings: [{ label: 'Correlation', value: 'Insufficient time-series data', severity: 'warning' }],
      };
    }
    const [linkage, score] = ranked[0];
    const share = Math.round((world.narrative.timeoutShare || 0) * 100);
    const label = {
      db_utilization: 'database connection utilization',
      db_timeouts: 'database timeouts',
      latency_ms: 'API latency',
      queue_lag: 'queue lag',
      token_errors: 'token errors',
      provider_rejects: 'provider rejects',
      checkout_cpu: 'checkout CPU',
    }[linkage] || linkage;
    const data = { base: baseKey, scores, linkage, score, failureSharePct: share || null, relationship: label };
    const summary = Math.abs(score) < 0.5
      ? `No strong relationship in the time series. Strongest candidate is ${label} (r=${score}).`
      : `Failures rose together with ${label} (r=${score}).${share ? ` ${share}% of recorded failures align with that signal.` : ''}`;
    return {
      summary,
      data,
      findings: [
        { label: 'Strongest link', value: `${label} r=${score}`, severity: Math.abs(score) > 0.7 ? 'critical' : 'warning' },
        { label: 'Failure share', value: `${share}%`, severity: 'warning' },
        { label: 'Compared with', value: args.signals.filter((signal) => signal !== linkage).join(', ') || 'none', severity: 'info' },
      ],
    };
  },
};
