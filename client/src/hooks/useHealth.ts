import { useEffect, useState } from 'react';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'checking';
  services?: {
    database: string;
    server: string;
  };
}

export function useHealth(intervalMs = 30_000) {
  const [health, setHealth] = useState<HealthStatus>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json() as HealthStatus & { success: boolean };
        if (!cancelled) {
          setHealth({
            status: data.success ? 'healthy' : 'unhealthy',
            services: data.services,
          });
        }
      } catch {
        if (!cancelled) setHealth({ status: 'unhealthy' });
      }
    };

    void check();
    const id = setInterval(() => void check(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return health;
}
