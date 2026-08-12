'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearSession, setToken, type User } from '@/lib/api';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>('/auth/me', {
        silent: true,
        skipAuthRedirect: true,
      });
      setUser(me);
    } catch {
      setUser(null);
      clearSession();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      if (pathname !== '/login') {
        router.replace('/login');
      }
    };
    window.addEventListener('app:session-expired', onExpired);
    return () => window.removeEventListener('app:session-expired', onExpired);
  }, [router, pathname]);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [loading, user, pathname, router]);

  const login = async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      loadingLabel: 'Signing in…',
      skipAuthRedirect: true,
    });
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api('/auth/logout', {
        method: 'POST',
        loadingLabel: 'Signing out…',
        skipAuthRedirect: true,
      });
    } catch {
      /* ignore */
    }
    clearSession();
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
