'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/lib/loading';

const DEMO_USERS = [
  {
    name: 'System Owner',
    email: 'owner@stemandspace.com',
    password: 'Owner123!',
    role: 'Owner',
    team: 'Support',
  },
  {
    name: 'Admin User',
    email: 'admin@stemandspace.com',
    password: 'Demo123!',
    role: 'Administrator',
    team: 'Support',
  },
  {
    name: 'Asha Sales',
    email: 'sales@stemandspace.com',
    password: 'Demo123!',
    role: 'Employee',
    team: 'Sales',
  },
  {
    name: 'Ravi Academic',
    email: 'academic@stemandspace.com',
    password: 'Demo123!',
    role: 'Employee',
    team: 'Academic',
  },
  {
    name: 'Neha Support',
    email: 'support@stemandspace.com',
    password: 'Demo123!',
    role: 'Employee',
    team: 'Support',
  },
] as const;

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreds, setShowCreds] = useState(false);

  if (!loading && user) {
    router.replace('/dashboard');
  }

  if (loading) {
    return (
      <div className="login-page">
        <PageLoader label="Checking session…" />
      </div>
    );
  }

  async function signIn(nextEmail: string, nextPassword: string) {
    setBusy(true);
    setError('');
    setEmail(nextEmail);
    setPassword(nextPassword);
    try {
      await login(nextEmail, nextPassword);
      setShowCreds(false);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await signIn(email, password);
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1>Workshop Operations</h1>
        <p className="muted">Attendance, delivery and sales — one availability spine.</p>
        <form onSubmit={onSubmit} style={{ marginTop: '1.25rem' }}>
          {error && <div className="error">{error}</div>}
          <label className="field">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              disabled={busy}
              placeholder="you@company.com"
            />
          </label>
          <label className="field">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              disabled={busy}
              placeholder="••••••••"
            />
          </label>
          <button className="btn large" disabled={busy || !email || !password}>
            {busy ? (
              <>
                <span className="spinner light" style={{ marginRight: 8 }} />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <button
          type="button"
          className="btn secondary demo-creds-trigger"
          disabled={busy}
          onClick={() => setShowCreds(true)}
        >
          Use demo credentials
        </button>
      </div>

      {showCreds && (
        <div
          className="modal-backdrop"
          onClick={() => !busy && setShowCreds(false)}
        >
          <div
            className="modal-card demo-creds-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-creds-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="demo-creds-header">
              <div>
                <h2 id="demo-creds-title">Demo accounts</h2>
                <p className="muted">Click any account to sign in instantly.</p>
              </div>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setShowCreds(false)}
              >
                Close
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="demo-creds-list">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  className="demo-cred-item"
                  disabled={busy}
                  onClick={() => signIn(u.email, u.password)}
                >
                  <div className="demo-cred-main">
                    <strong>{u.name}</strong>
                    <span className="muted">{u.email}</span>
                  </div>
                  <div className="demo-cred-meta">
                    <span className="badge">{u.role}</span>
                    <span className="badge">{u.team}</span>
                  </div>
                  <div className="demo-cred-action">
                    {busy && email === u.email ? (
                      <>
                        <span className="spinner" /> Signing in…
                      </>
                    ) : (
                      'Login →'
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
