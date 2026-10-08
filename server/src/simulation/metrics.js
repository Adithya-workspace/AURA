import { rampMs } from './pacing.js';

function lerp(from, to, t) {
  return from + (to - from) * t;
}

export function judgeVerdict(before, after) {
  const errorRate = after.errorRate;
  const latImprove = before.latencyMs > 0 ? (before.latencyMs - after.latencyMs) / before.latencyMs : 0;
  const errImprove = before.errorRate > 0 ? (before.errorRate - after.errorRate) / before.errorRate : 0;
  const resourceOk = after.resource < (after.resourceThreshold ?? before.resourceThreshold);
  if (errorRate < 0.03 && latImprove > 0.5 && resourceOk) return 'CONFIRMED';
  if (errImprove > 0.3 || latImprove > 0.3) return 'PARTIAL';
  return 'NOT_CONFIRMED';
}

export function rampProgress(world) {
  const ramp = world.clock.ramp;
  if (!ramp) return world.clock.applied.length ? 1 : 0;
  return Math.min(1, (Date.now() - ramp.startedAt) / rampMs(world.pacing));
}

export function liveSnapshot(world) {
  const base = world.narrative.baseline;
  const ramp = world.clock.ramp;
  if (!ramp) {
    return { ...base };
  }
  const t = rampProgress(world);
  return {
    errorRate: lerp(ramp.from.errorRate, ramp.target.errorRate, t),
    latencyMs: lerp(ramp.from.latencyMs, ramp.target.latencyMs, t),
    resource: lerp(ramp.from.resource, ramp.target.resource, t),
    resourceLabel: base.resourceLabel,
    resourceThreshold: base.resourceThreshold,
    serviceStatus: t > 0.9 && ramp.target.errorRate < 0.03 ? 'HEALTHY' : 'DEGRADED',
  };
}

export function deltas(before, after) {
  return {
    errorRate: after.errorRate - before.errorRate,
    latencyMs: after.latencyMs - before.latencyMs,
    resource: after.resource - before.resource,
  };
}
