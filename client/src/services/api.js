const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    const error = new Error('Cannot reach the AURA API');
    error.code = 'network';
    throw error;
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Request failed');
    error.code = data?.error?.code || 'request_failed';
    throw error;
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),
  authConfig: () => request('/api/auth/config'),
  me: () => request('/api/auth/me'),
  googleSignIn: (credential) => request('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  slackStart: () => request('/api/auth/slack'),
  stats: () => request('/api/stats'),
  scenarios: () => request('/api/scenarios'),
  tools: () => request('/api/tools'),
  incidents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.severity) query.set('severity', params.severity);
    const suffix = query.toString() ? `?${query}` : '';
    return request(`/api/incidents${suffix}`);
  },
  incident: (id) => request(`/api/incidents/${id}`),
  createIncident: (body) => request('/api/incidents', { method: 'POST', body: JSON.stringify(body) }),
  run: (id, body) => request(`/api/incidents/${id}/run`, { method: 'POST', body: JSON.stringify(body) }),
  approve: (id, remediationId) => request(`/api/incidents/${id}/approve`, { method: 'POST', body: JSON.stringify({ remediationId }) }),
  reject: (id, remediationId, reason) => request(`/api/incidents/${id}/reject`, { method: 'POST', body: JSON.stringify({ remediationId, reason }) }),
  events: (id, after = 0) => request(`/api/incidents/${id}/events?after=${after}`, { headers: { accept: 'application/json' } }),
  runs: () => request('/api/runs'),
  runDetail: (id) => request(`/api/runs/${id}`),
  demo: (body) => request('/api/demo/run', { method: 'POST', body: JSON.stringify(body) }),
  reset: () => request('/api/admin/reset', { method: 'POST' }),
  reportText: async (id, format) => {
    const response = await fetch(`${BASE}/api/incidents/${id}/report?format=${format}`);
    if (!response.ok) throw new Error('Report is not ready');
    return response.text();
  },
};

export function reportUrl(id, format) {
  return `${BASE}/api/incidents/${id}/report?format=${format}`;
}
