import { z } from 'zod';

export const tool = {
  name: 'analyze_logs',
  description: 'Summarize recent logs: event count, error count, top errors, and a timeline.',
  safety: 'read',
  agentRole: 'Log Analyst',
  appliesTo: ['payments', 'authentication', 'orders', 'notifications', 'unknown'],
  inputSchema: z.object({
    service: z.string().min(1).max(80),
    timeframe: z.string().min(1).max(16).default('30m'),
  }),
  execute(args, world) {
    if (args.service === 'uploaded-evidence') {
      const uploads = world.uploads || [];
      if (!uploads.length) throw new Error('No uploaded evidence is attached to this incident');
      const lines = uploads.flatMap((file) => file.content.split(/\r?\n/).slice(0, 40).map((line) => `${file.filename}: ${line}`));
      return {
        summary: `Read ${uploads.length} uploaded file${uploads.length === 1 ? '' : 's'}. This is supplied evidence, not live service telemetry.`,
        data: { service: 'uploaded-evidence', source: 'upload', files: uploads.map((file) => file.filename), samples: lines.slice(0, 12) },
        findings: [{ label: 'Uploaded files', value: uploads.map((file) => file.filename).join(', '), severity: 'info' }],
      };
    }
    const logs = world.logs[args.service];
    if (!logs) throw new Error(`No logs for ${args.service}`);
    const buckets = (world.series.error_rate || []).slice(-30).map((rate, index) => ({
      bucket: index,
      errors: Math.round(rate * (logs.errorCount / 4)),
    }));
    const data = {
      service: args.service,
      timeframe: args.timeframe,
      eventCount: logs.eventCount,
      errorCount: logs.errorCount,
      topErrors: logs.topErrors,
      samples: logs.samples,
      timeline: buckets,
    };
    return {
      summary: `${logs.eventCount.toLocaleString('en-US')} events, ${logs.errorCount} errors in ${args.timeframe}`,
      data,
      findings: [
        { label: 'Events', value: logs.eventCount.toLocaleString('en-US'), severity: 'info' },
        { label: 'Errors', value: String(logs.errorCount), severity: logs.errorCount > 50 ? 'critical' : 'info' },
        { label: 'Top error', value: logs.topErrors[0]?.message || 'none', severity: 'critical' },
      ],
    };
  },
};
