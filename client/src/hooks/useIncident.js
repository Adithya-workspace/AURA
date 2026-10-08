import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useIncident(id) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await api.incident(id));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  return { data, error, loading, reload: load };
}
