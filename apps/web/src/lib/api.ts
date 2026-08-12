const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'employee' | 'administrator' | 'owner';
  team: 'sales' | 'academic' | 'support';
  employeeCode: string;
  baseCity?: string;
};

export type ApiOptions = RequestInit & {
  /** Skip global loading indicators */
  silent?: boolean;
  /** Force full-screen overlay (default for mutations) */
  overlay?: boolean;
  /** Custom overlay / progress label */
  loadingLabel?: string;
};

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

async function withLoading<T>(
  method: string,
  path: string,
  options: ApiOptions,
  run: () => Promise<T>,
): Promise<T> {
  if (options.silent || typeof window === 'undefined') {
    return run();
  }

  const { beginApiLoading, endApiLoading } = await import('./loading');
  const meta = {
    method,
    path,
    label: options.loadingLabel,
    overlay: options.overlay,
  };
  beginApiLoading(meta);
  try {
    return await run();
  } finally {
    endApiLoading(meta);
  }
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { silent, overlay, loadingLabel, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();

  return withLoading(method, path, options, async () => {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {}),
    };
    if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data as T;
  });
}

export { API_URL };
