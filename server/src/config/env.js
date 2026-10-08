import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  AI_PROVIDER: z.enum(['gemini', 'openai', 'anthropic', 'mock']).default('mock'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default(''),
  DEMO_PACING: z.enum(['fast', 'normal', 'slow']).default('normal'),
  AURA_DB_PATH: z.string().default('./data/aura.sqlite'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default(''),
});

function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    break;
  }
}

loadEnvFile();

export const env = schema.parse({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_API_KEY: process.env.AI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  DEMO_PACING: process.env.DEMO_PACING,
  AURA_DB_PATH: process.env.AURA_DB_PATH,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
  SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI,
});

export function isProd() {
  return env.NODE_ENV === 'production';
}
