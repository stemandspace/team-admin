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
  /** Do not redirect on 401 (used by login / session probe) */
  skipAuthRedirect?: boolean;
};

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function clearSession() {
  setToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('app:session-expired'));
  }
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (path === '/login') return;
  const next = `${path}${window.location.search || ''}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
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
  const { silent, overlay, loadingLabel, skipAuthRedirect, ...fetchOptions } = options;
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
      if (res.status === 401) {
        const isAuthRoute = path.startsWith('/auth/login') || path.startsWith('/auth/me');
        clearSession();
        if (!skipAuthRedirect && !isAuthRoute) {
          redirectToLogin();
        }
        throw new ApiError(data.error || 'Unauthorized', 401);
      }
      throw new ApiError(
        data.error || data.message || `Request failed (${res.status})`,
        res.status,
        typeof data === 'object' && data ? data : {},
      );
    }
    return data as T;
  });
}

export { API_URL };
