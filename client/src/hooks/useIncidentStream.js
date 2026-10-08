import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { openIncidentStream } from '../services/sse.js';
import { reduceEvents } from '../lib/eventReducer.js';

export function useIncidentStream(incidentId) {
  const [events, setEvents] = useState([]);
  const [transport, setTransport] = useState('connecting');

  useEffect(() => {
    if (!incidentId) return undefined;
    let stopped = false;
    let after = 0;
    let failures = 0;
    let poll;
    let close = () => {};
    const seen = new Set();

    function add(batch) {
      const fresh = batch.filter((event) => {
        if (seen.has(event.seq)) return false;
        seen.add(event.seq);
        after = Math.max(after, event.seq);
        return true;
      });
      if (fresh.length) setEvents((current) => [...current, ...fresh].sort((a, b) => a.seq - b.seq));
    }

    async function pollOnce() {
      try {
        const body = await api.events(incidentId, after);
        add(body.events || []);
        setTransport('polling');
      } catch {
        setTransport('offline');
      }
    }

    function startPolling() {
      setTransport('polling');
      pollOnce();
      poll = setInterval(pollOnce, 1500);
    }

    function connect() {
      if (stopped) return;
      close = openIncidentStream(incidentId, {
        onEvent: (event) => {
          failures = 0;
          setTransport('live');
          add([event]);
        },
        onFail: () => {
          failures += 1;
          if (stopped) return;
          if (failures >= 2) startPolling();
          else setTimeout(connect, 400);
        },
      });
    }

    api.events(incidentId, 0).then((body) => {
      if (stopped) return;
      add(body.events || []);
      connect();
    }).catch(() => startPolling());

    return () => {
      stopped = true;
      close();
      clearInterval(poll);
    };
  }, [incidentId]);

  return { events, view: reduceEvents(events), transport };
}
