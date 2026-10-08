import { env } from '../config/env.js';
import { log } from '../utils/logger.js';
import { fallbackDecision } from '../agents/policy/fallbackPolicy.js';

let fallbackUsed = env.AI_PROVIDER === 'mock';

export function aiStatus() {
  const model = env.AI_MODEL || defaultModel(env.AI_PROVIDER);
  return {
    provider: env.AI_PROVIDER,
    model,
    mode: env.AI_PROVIDER === 'mock' || fallbackUsed ? 'fallback policy' : 'live',
    fallbackUsed: env.AI_PROVIDER === 'mock' || fallbackUsed,
  };
}

function defaultModel(provider) {
  if (provider === 'openai') return 'gpt-4o-mini';
  if (provider === 'anthropic') return 'claude-3-5-haiku-latest';
  if (provider === 'gemini') return 'gemini-2.0-flash';
  return 'deterministic-fallback';
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('Model did not return JSON');
  }
}

async function callProvider({ system, user, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (env.AI_PROVIDER === 'openai') return extractJson(await openAi(system, user, controller.signal));
    if (env.AI_PROVIDER === 'anthropic') return extractJson(await anthropic(system, user, controller.signal));
    if (env.AI_PROVIDER === 'gemini') return extractJson(await gemini(system, user, controller.signal));
    throw new Error('No live provider');
  } finally {
    clearTimeout(timer);
  }
}

async function openAi(system, user, signal) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${env.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.AI_MODEL || defaultModel('openai'),
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const body = await response.json();
  return body.choices?.[0]?.message?.content || '';
}

async function anthropic(system, user, signal) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': env.AI_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.AI_MODEL || defaultModel('anthropic'),
      max_tokens: 1200,
      temperature: 0.1,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}`);
  const body = await response.json();
  return body.content?.map((part) => part.text || '').join('\n') || '';
}

async function gemini(system, user, signal) {
  const model = env.AI_MODEL || defaultModel('gemini');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.AI_API_KEY)}`,
    {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini ${response.status}`);
  const body = await response.json();
  return body.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
}

export async function generateStructured({ system, user, schema, schemaName, context, timeoutMs = 20000 }) {
  if (env.AI_PROVIDER === 'mock' || !env.AI_API_KEY) {
    if (env.AI_PROVIDER !== 'mock') {
      fallbackUsed = true;
      log('warn', 'AI key missing, using fallback policy');
    }
    return schema.parse(fallbackDecision(schemaName, context));
  }

  try {
    return schema.parse(await callProvider({ system, user, timeoutMs }));
  } catch (error) {
    try {
      const repaired = await callProvider({
        system,
        user: `${user}\n\nThe previous JSON failed validation: ${error.message}. Return corrected JSON only.`,
        timeoutMs,
      });
      return schema.parse(repaired);
    } catch (second) {
      fallbackUsed = true;
      log('warn', 'LLM failed, using fallback policy', { schemaName, message: second.message });
      return schema.parse(fallbackDecision(schemaName, context));
    }
  }
}
