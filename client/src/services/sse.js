const BASE = import.meta.env.VITE_API_URL || '';

export function openIncidentStream(id, { onEvent, onFail }) {
  const source = new EventSource(`${BASE}/api/incidents/${id}/events`);
  source.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data));
    } catch {
      /* ignore malformed frames */
    }
  };
  source.onerror = () => {
    source.close();
    onFail?.();
  };
  return () => source.close();
}
