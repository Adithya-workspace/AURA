import { afterEach, describe, expect, it, vi } from 'vitest';

const mockConstructorCalls = [];

vi.mock('libsql', () => {
    return {
        default: class MockDatabase {
            constructor(url, options) {
                mockConstructorCalls.push({ url, options });
            }
            exec() { }
            prepare() {
                return {
                    all: () => [],
                    get: () => null,
                    run: () => ({}),
                };
            }
            pragma() { }
        },
    };
});

describe('database initialization', () => {
    afterEach(() => {
        vi.resetModules();
        mockConstructorCalls.length = 0;
        delete process.env.TURSO_DATABASE_URL;
        delete process.env.TURSO_AUTH_TOKEN;
        delete process.env.AURA_DB_PATH;
    });

    it('prefers Turso when configured', async () => {
        process.env.TURSO_DATABASE_URL = 'libsql://demo-db.turso.io';
        process.env.TURSO_AUTH_TOKEN = 'test-token';
        process.env.AURA_DB_PATH = './tmp/aura.sqlite';

        const { initDb } = await import('../src/database/db.js');
        const handle = await initDb();
        expect(handle.kind).toBe('libsql');
        expect(mockConstructorCalls[0]).toMatchObject({
            url: 'libsql://demo-db.turso.io',
            options: { authToken: 'test-token' },
        });
    });
});
