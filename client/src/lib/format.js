export function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

export function formatWhen(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { hour12: false });
}

export function formatPct(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function formatMs(value) {
  if (value === undefined || value === null) return '—';
  const n = Number(value);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${Math.round(n)}ms`;
}

export function formatDuration(ms) {
  if (!ms && ms !== 0) return '—';
  const seconds = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min ? `${min}m ${sec}s` : `${sec}s`;
}

export function prettyTool(name = '') {
  return name.replaceAll('_', ' ');
}

export function metricNumber(value, kind) {
  if (value === undefined || value === null) return '—';
  if (kind === 'error') return formatPct(value);
  if (kind === 'latency') return formatMs(value);
  if (kind === 'resource' && value <= 1) return formatPct(value);
  return String(Math.round(value));
}
