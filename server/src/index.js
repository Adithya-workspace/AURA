import path from 'path';
import { pathToFileURL } from 'url';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initDb } from './database/db.js';
import { markOrphans, seed } from './database/seed.js';
import { log } from './utils/logger.js';

export async function start() {
  await initDb();
  const orphans = markOrphans();
  if (orphans) log('warn', 'marked interrupted runs', { orphans });
  seed();
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listener = app.listen(env.PORT, () => resolve(listener));
  });
  log('info', `AURA API listening on ${env.PORT}`);
  return server;
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entry) {
  start().catch((error) => {
    log('error', 'failed to start', { message: error.message });
    process.exit(1);
  });
}
