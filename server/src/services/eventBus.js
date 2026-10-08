import { eventsRepo } from '../database/repositories/events.js';

const subscribers = new Map();

export function subscribe(incidentId, res) {
  if (!subscribers.has(incidentId)) subscribers.set(incidentId, new Set());
  subscribers.get(incidentId).add(res);
  return () => {
    subscribers.get(incidentId)?.delete(res);
  };
}

export function publish(event) {
  const row = eventsRepo.append(event);
  const chunk = `id: ${row.seq}\ndata: ${JSON.stringify(row)}\n\n`;
  for (const res of subscribers.get(event.incidentId) || []) {
    res.write(chunk);
  }
  return row;
}
