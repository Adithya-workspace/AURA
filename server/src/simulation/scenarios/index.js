import { paymentsScenario } from './payments.js';
import { authScenario } from './auth.js';
import { ordersScenario } from './orders.js';
import { notificationsScenario } from './notifications.js';

const builders = {
  payments: paymentsScenario,
  authentication: authScenario,
  orders: ordersScenario,
  notifications: notificationsScenario,
};

export const SCENARIO_KEYS = Object.keys(builders);

export function buildScenario(key, now = Date.now()) {
  const build = builders[key];
  if (!build) return null;
  return build(now);
}

export function listScenarios() {
  return SCENARIO_KEYS.map((key) => {
    const scenario = buildScenario(key);
    return {
      key,
      title: scenario.title,
      description: scenario.description,
      category: scenario.category,
      severity: scenario.severity,
    };
  });
}

export function classifyText(text) {
  const value = text.toLowerCase();
  if (/payment|charge|card|upi|pool/.test(value)) return 'payments';
  if (/checkout/.test(value)) return 'checkout';
  if (/auth|login|jwt|sign-in|signin|token/.test(value)) return 'authentication';
  if (/inventory/.test(value)) return 'inventory';
  if (/order|fulfill|queue backlog|worker/.test(value)) return 'orders';
  if (/notif|email|sms|sendgrid/.test(value)) return 'notifications';
  if (/database|postgres|mysql/.test(value)) return 'database';
  if (/analytics|dashboard/.test(value)) return 'analytics';
  if (/deploy|deployment|release|rollback|config change/.test(value)) return 'deployment';
  return 'custom';
}
