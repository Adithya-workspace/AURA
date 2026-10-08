import { beforeAll, describe, expect, it } from 'vitest';
import { initDb } from '../src/database/db.js';
import { executeTool } from '../src/tools/registry.js';
import { createWorld } from '../src/simulation/world.js';
import { approvalMatches } from '../src/services/approvalService.js';
import { hashArgs } from '../src/utils/hash.js';
import { understandSchema } from '../src/agents/schemas.js';

beforeAll(async () => {
  await initDb();
});

describe('tool safety', () => {
  it('blocks destructive tools and unapproved writes', async () => {
    const world = createWorld('payments', { pacing: 'fast' });
    const ctx = { world, incidentId: 'seed-inc-payments', phase: 'act', pacing: 'fast' };
    const destroyed = await executeTool('delete_records', { table: 'charges', confirm: true }, ctx);
    expect(destroyed.status).toBe('blocked');
    const write = await executeTool('apply_remediation', {
      action: 'update_db_pool_size',
      params: { database: 'payments-db', size: 200 },
    }, ctx);
    expect(write.status).toBe('blocked');
  });

  it('rejects invalid tool input', async () => {
    const world = createWorld('payments', { pacing: 'fast' });
    const result = await executeTool('get_service_metrics', {}, {
      world,
      incidentId: 'seed-inc-payments',
      phase: 'investigate',
      pacing: 'fast',
    });
    expect(result.status).toBe('failed');
  });
});

describe('approval hash', () => {
  it('refuses a mismatched args hash', () => {
    const args = { action: 'update_db_pool_size', params: { database: 'payments-db', size: 200 } };
    const record = {
      status: 'approved',
      tool: 'apply_remediation',
      args_hash: hashArgs('apply_remediation', args),
    };
    expect(approvalMatches(record, 'apply_remediation', args)).toBe(true);
    expect(approvalMatches(record, 'apply_remediation', {
      action: 'update_db_pool_size',
      params: { database: 'payments-db', size: 300 },
    })).toBe(false);
    expect(approvalMatches({ ...record, status: 'proposed' }, 'apply_remediation', args)).toBe(false);
  });
});

describe('structured output schema', () => {
  it('rejects a plan that is missing fields', () => {
    const parsed = understandSchema.safeParse({ category: 'payments' });
    expect(parsed.success).toBe(false);
  });
});
