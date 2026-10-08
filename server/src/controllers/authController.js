import { randomBytes } from 'crypto';
import { env, isProd } from '../config/env.js';
import { httpError } from '../utils/http.js';

const sessions = new Map();

function cookieValue(req) {
  const raw = req.headers.cookie || '';
  const part = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith('aura_session='));
  return part ? decodeURIComponent(part.slice('aura_session='.length)) : '';
}

function writeSession(res, user) {
  const id = randomBytes(24).toString('hex');
  sessions.set(id, user);
  const secure = isProd() ? '; Secure' : '';
  res.setHeader('Set-Cookie', `aura_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);
}

export function authConfig() {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID),
    slack: Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.SLACK_REDIRECT_URI),
    googleClientId: env.GOOGLE_CLIENT_ID || null,
  };
}

export function currentUser(req) {
  const id = cookieValue(req);
  return id ? sessions.get(id) || null : null;
}

export async function googleSignIn(credential) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw httpError(409, 'not_configured', 'Google authentication is not configured yet.');
  }
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.aud !== env.GOOGLE_CLIENT_ID || !payload.sub) {
    throw httpError(401, 'unauthorized', 'Google did not accept that sign-in.');
  }
  return {
    provider: 'google',
    name: payload.name || payload.email || 'Google user',
  };
}

export function beginSession(res, user) {
  writeSession(res, user);
  return user;
}

export function slackAuthorizeUrl() {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_REDIRECT_URI) {
    throw httpError(409, 'not_configured', 'Slack authentication is not configured yet.');
  }
  const url = new URL('https://slack.com/openid/connect/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.SLACK_REDIRECT_URI);
  return url.toString();
}

export async function slackExchange(code) {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_REDIRECT_URI) {
    throw httpError(409, 'not_configured', 'Slack authentication is not configured yet.');
  }
  const body = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://slack.com/api/openid.connect.token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw httpError(401, 'unauthorized', 'Slack did not accept that sign-in.');
  }
  return {
    provider: 'slack',
    name: 'Slack user',
  };
}
