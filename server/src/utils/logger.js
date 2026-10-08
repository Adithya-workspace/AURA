const SECRET_KEY = /api[_-]?key|secret|token|authorization|password|bearer/i;

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SECRET_KEY.test(key) ? '[redacted]' : redact(inner)]),
    );
  }
  if (typeof value === 'string' && /sk-[a-z0-9]/i.test(value)) return '[redacted]';
  return value;
}

export function log(level, message, meta) {
  const line = meta ? `${message} ${JSON.stringify(redact(meta))}` : message;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
