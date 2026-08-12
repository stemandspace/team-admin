'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('owner@stemandspace.com');
  const [password, setPassword] = useState('Owner123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    router.replace('/dashboard');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
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
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="field">
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>
          <button className="btn large" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
          Demo: owner@stemandspace.com / Owner123! · sales@ / academic@ / support@ / admin@ · Demo123!
        </p>
      </div>
    </div>
  );
}
