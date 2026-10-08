import { incidentsRepo } from '../database/repositories/incidents.js';

const SERVICES = [
  { name: 'payment-service', category: 'payments' },
  { name: 'auth-service', category: 'authentication' },
  { name: 'order-service', category: 'orders' },
  { name: 'notification-service', category: 'notifications' },
  { name: 'checkout-service', category: 'payments' },
];

export function getStats() {
  const incidents = incidentsRepo.list();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const active = incidents.filter((incident) => !['resolved', 'escalated'].includes(incident.status));
  const resolvedToday = incidents.filter((incident) => incident.status === 'resolved' && Number(incident.resolved_at) >= start.getTime());
  const finished = incidents.filter((incident) => incident.status === 'resolved' || incident.status === 'escalated');
  const successes = finished.filter((incident) => incident.status === 'resolved').length;
  const activeCategories = new Set(active.map((incident) => incident.category));
  return {
    systemStatus: 'operational',
    activeIncidents: active.length,
    resolvedToday: resolvedToday.length,
    successRate: finished.length ? successes / finished.length : 0,
    services: SERVICES.map((service) => ({
      name: service.name,
      status: activeCategories.has(service.category) ? 'DEGRADED' : 'HEALTHY',
    })),
    active: active.slice(0, 5).map(summary),
    recent: incidents.slice(0, 8).map(summary),
  };
}

function summary(incident) {
  return {
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    category: incident.category,
    createdAt: incident.created_at,
  };
}
