'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { PageLoader } from '@/lib/loading';

type Today = {
  serverTime: string;
  record: {
    id: string;
    punchInTime?: string;
    punchOutTime?: string;
    status?: string;
    isLate?: boolean;
    hoursWorked?: number;
  } | null;
  personalAbsenceMinutesMonthly: number;
  freeMinutes: number;
  openStepOut: { id: string; status: string } | null;
};

export default function AttendancePage() {
  const [today, setToday] = useState<Today | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [workLocation, setWorkLocation] = useState('office');
  const [lateReason, setLateReason] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load(initial = false) {
    if (initial) setLoading(true);
    try {
      const t = await api<Today>('/attendance/today', {
        loadingLabel: initial ? 'Loading attendance…' : undefined,
        silent: !initial,
      });
      setToday(t);
      setHistory(await api('/attendance/mine', { silent: !initial }));
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    load(true).catch((e) => setError(e.message));
  }, []);

  async function punchIn() {
    setError('');
    setMsg('');
    setBusy(true);
    try {
      await api('/attendance/punch-in', {
        method: 'POST',
        loadingLabel: 'Punching in…',
        body: JSON.stringify({
          workLocation,
          lateReason: lateReason || null,
          punchInLat: workLocation === 'office' ? 18.52 : null,
          punchInLng: workLocation === 'office' ? 73.85 : null,
        }),
      });
      setMsg('Punched in (server time)');
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function punchOut() {
    setError('');
    setBusy(true);
    try {
      await api('/attendance/punch-out', {
        method: 'POST',
        loadingLabel: 'Punching out…',
      });
      setMsg('Punched out');
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h1>My Day</h1>
      <p className="muted">Timestamps always come from the server clock.</p>
      {error && <div className="error">{error}</div>}
      {msg && <p style={{ color: 'var(--ok)' }}>{msg}</p>}
      {loading ? (
        <PageLoader label="Loading your day…" />
      ) : (
        <div className="grid grid-2" style={{ marginTop: '1rem' }}>
          <div className="card">
            <div className="punch-time">
              {today ? new Date(today.serverTime).toLocaleTimeString('en-IN') : '—'}
            </div>
            <label className="field">
              Work location
              <select
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                disabled={busy}
              >
                <option value="office">Office</option>
                <option value="home">Work from home</option>
                <option value="client_site">Client site</option>
                <option value="travel">Travel</option>
              </select>
            </label>
            <label className="field">
              Late reason (required if late)
              <input
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                disabled={busy}
              />
            </label>
            {!today?.record?.punchInTime ? (
              <button className="btn large" onClick={punchIn} disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner light" style={{ marginRight: 8 }} />
                    Punching in…
                  </>
                ) : (
                  'Punch in'
                )}
              </button>
            ) : !today.record.punchOutTime ? (
              <button className="btn large" onClick={punchOut} disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner light" style={{ marginRight: 8 }} />
                    Punching out…
                  </>
                ) : (
                  'Punch out'
                )}
              </button>
            ) : (
              <p className="muted">Day complete · {today.record.hoursWorked} hours</p>
            )}
            <p className="muted" style={{ marginTop: '1rem' }}>
              Personal step-out this month: {today?.personalAbsenceMinutesMonthly || 0} /{' '}
              {today?.freeMinutes || 120} free minutes
            </p>
          </div>
          <div className="card">
            <h3>Recent attendance</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Hours</th>
                  <th>Late</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 14).map((r) => (
                  <tr key={String(r.id)}>
                    <td>{new Date(String(r.date)).toLocaleDateString('en-IN')}</td>
                    <td>{String(r.status)}</td>
                    <td>{r.hoursWorked != null ? String(r.hoursWorked) : '—'}</td>
                    <td>{r.isLate ? <span className="badge warn">Yes</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
