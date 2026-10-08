import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useStats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await api.stats());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { data, error, loading, reload: load };
}
