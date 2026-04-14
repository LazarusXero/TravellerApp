import { useState, useCallback } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const json = await res.json();
  return json as ApiResponse<T>;
}

export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (path: string, options?: RequestInit): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await apiFetch<T>(path, options);
        if (result.success && result.data !== undefined) {
          setState({ data: result.data, loading: false, error: null });
          return result.data;
        } else {
          setState({
            data: null,
            loading: false,
            error: result.error ?? 'Unknown error',
          });
          return null;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Network error';
        setState({ data: null, loading: false, error: message });
        return null;
      }
    },
    []
  );

  return { ...state, execute };
}

export { apiFetch };
