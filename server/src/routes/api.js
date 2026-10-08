import { z } from 'zod';
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncRoute, httpError } from '../utils/http.js';
import {
  approveIncident,
  createIncident,
  createIncidentSchema,
  getIncident,
  incidentReport,
  listIncidents,
  rejectIncident,
  runDemo,
  runIncident,
  scenarioList,
} from '../controllers/incidentsController.js';
import { eventsRepo } from '../database/repositories/events.js';
import { incidentsRepo } from '../database/repositories/incidents.js';
import { subscribe } from '../services/eventBus.js';
import { aiStatus } from '../llm/index.js';
import { getStats } from '../services/statsService.js';
import { toolCatalog } from '../tools/registry.js';
import { toolExecutionsRepo } from '../database/repositories/toolExecutions.js';
import { runsRepo } from '../database/repositories/runs.js';
import { resetDemoData } from '../database/seed.js';
import { pacingOf } from '../simulation/pacing.js';
import {
  authConfig,
  beginSession,
  currentUser,
  googleSignIn,
  slackAuthorizeUrl,
  slackExchange,
} from '../controllers/authController.js';

const pacingSchema = z.object({
  pacing: z.enum(['fast', 'normal', 'slow']).optional(),
  partialRecovery: z.boolean().optional(),
});

const idSchema = z.object({ id: z.string().min(3).max(80) });

export function apiRouter() {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'aura', ai: aiStatus() });
  });

  router.get('/auth/config', (_req, res) => {
    res.json(authConfig());
  });

  router.get('/auth/me', (req, res) => {
    res.json({ user: currentUser(req) });
  });

  router.post('/auth/google', validate({
    body: z.object({ credential: z.string().min(20).max(8000) }),
  }), asyncRoute(async (req, res) => {
    const user = beginSession(res, await googleSignIn(req.body.credential));
    res.json({ user });
  }));

  router.get('/auth/slack', asyncRoute((_req, res) => {
    res.json({ url: slackAuthorizeUrl() });
  }));

  router.get('/auth/slack/callback', async (req, res) => {
    try {
      if (!req.query.code) throw new Error('missing code');
      beginSession(res, await slackExchange(String(req.query.code)));
      res.redirect('/app');
    } catch {
      res.redirect('/signin?error=slack_failed');
    }
  });

  router.get('/stats', (_req, res) => {
    res.json(getStats());
  });

  router.get('/scenarios', (_req, res) => {
    res.json({ scenarios: scenarioList() });
  });

  router.get('/tools', (_req, res) => {
    const counts = Object.fromEntries(toolExecutionsRepo.counts().map((row) => [row.tool, row.count]));
    res.json({
      tools: toolCatalog().map((tool) => ({
        ...tool,
        usageCount: Number(counts[tool.name] || 0),
        approval: tool.safety === 'write',
        blocked: tool.safety === 'destructive',
      })),
    });
  });

  router.get('/incidents', validate({
    query: z.object({
      status: z.string().max(40).optional(),
      severity: z.string().max(40).optional(),
    }),
  }), asyncRoute((req, res) => {
    res.json({ incidents: listIncidents(req.query) });
  }));

  router.post('/incidents', validate({ body: createIncidentSchema }), asyncRoute((req, res) => {
    res.status(201).json({ incident: createIncident(req.body) });
  }));

  router.get('/incidents/:id', validate({ params: idSchema }), asyncRoute((req, res) => {
    res.json(getIncident(req.params.id));
  }));

  router.post('/incidents/:id/run', validate({ params: idSchema, body: pacingSchema }), asyncRoute((req, res) => {
    const result = runIncident(req.params.id, { ...req.body, pacing: pacingOf(req.body.pacing) });
    res.status(202).json(result);
  }));

  router.post('/incidents/:id/approve', validate({
    params: idSchema,
    body: z.object({ remediationId: z.string().min(3) }),
  }), asyncRoute((req, res) => {
    res.json({ remediation: approveIncident(req.params.id, req.body.remediationId) });
  }));

  router.post('/incidents/:id/reject', validate({
    params: idSchema,
    body: z.object({ remediationId: z.string().min(3), reason: z.string().max(400).optional() }),
  }), asyncRoute((req, res) => {
    res.json({ remediation: rejectIncident(req.params.id, req.body.remediationId, req.body.reason) });
  }));

  router.get('/incidents/:id/events', validate({
    params: idSchema,
    query: z.object({ after: z.coerce.number().int().nonnegative().optional() }),
  }), asyncRoute((req, res) => {
    const incident = incidentsRepo.get(req.params.id);
    if (!incident) throw httpError(404, 'not_found', 'Incident not found');
    const accept = req.get('accept') || '';
    if (accept.includes('application/json') || req.query.after !== undefined) {
      res.json({ events: eventsRepo.list(incident.id, Number(req.query.after || 0)) });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const last = Number(req.get('last-event-id') || 0);
    for (const event of eventsRepo.list(incident.id, last)) {
      res.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
    }
    const unsubscribe = subscribe(incident.id, res);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }));

  router.get('/incidents/:id/report', validate({
    params: idSchema,
    query: z.object({ format: z.enum(['json', 'md', 'html']).optional() }),
  }), asyncRoute((req, res) => {
    const report = incidentReport(req.params.id, req.query.format || 'json');
    if (report.type === 'md') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(report.body);
      return;
    }
    if (report.type === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(report.body);
      return;
    }
    res.json(report.body);
  }));

  router.get('/runs', (_req, res) => {
    const runs = runsRepo.list().map((run) => ({
      ...run,
      tools: toolExecutionsRepo.forRun(run.id).length,
    }));
    res.json({ runs });
  });

  router.get('/runs/:id', validate({ params: idSchema }), asyncRoute((req, res) => {
    const run = runsRepo.get(req.params.id);
    if (!run) throw httpError(404, 'not_found', 'Run not found');
    res.json({
      run,
      executions: toolExecutionsRepo.forRun(run.id),
      events: eventsRepo.list(run.incident_id, 0).filter((event) => event.runId === run.id),
    });
  }));

  router.post('/demo/run', validate({ body: pacingSchema }), asyncRoute((req, res) => {
    res.status(202).json(runDemo(req.body));
  }));

  router.post('/admin/reset', (_req, res) => {
    resetDemoData();
    res.json({ ok: true });
  });

  return router;
}
