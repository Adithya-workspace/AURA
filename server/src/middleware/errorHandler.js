import { isProd } from '../config/env.js';
import { log } from '../utils/logger.js';

export function errorHandler(error, req, res, _next) {
  const status = error.status || 500;
  if (status >= 500) log('error', 'request failed', { path: req.path, message: error.message });
  const message = status >= 500 && isProd() ? 'Internal error' : error.message || 'Request failed';
  res.status(status).json({ error: { code: error.code || 'internal_error', message } });
}
