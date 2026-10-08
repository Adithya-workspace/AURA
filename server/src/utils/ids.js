import { randomBytes } from 'crypto';

export function newId(prefix) {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}
