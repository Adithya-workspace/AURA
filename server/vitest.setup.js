import os from 'os';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(os.tmpdir(), `aura-vitest-${process.pid}.sqlite`);
for (const file of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`]) {
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}
process.env.AURA_DB_PATH = dbPath;
process.env.AI_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';
process.env.DEMO_PACING = 'fast';
process.env.PORT = '8799';
