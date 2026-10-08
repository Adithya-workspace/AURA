import { createHash } from 'crypto';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stable(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function hashArgs(tool, args) {
  return createHash('sha256').update(JSON.stringify(stable({ tool, args }))).digest('hex');
}
