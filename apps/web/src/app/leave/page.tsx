'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function LeavePage() {
  const [balances, setBalances] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [preview, setPreview] = useState<{ daysCounted: number; conflict: unknown } | null>(null);
  const [form, setForm] = useState({
    fromDate: '',
    toDate: '',
    leaveType: 'casual',
    isHalfDay: false,
    reason: '',
    substitutePersonId: '',
  });
  const [error, setError] = useState('');

  async function load() {
    setBalances(await api('/leave/balances'));
    setRequests(await api('/leave'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function refreshPreview() {
    if (!form.fromDate || !form.toDate) return;
    const q = new URLSearchParams({
      fromDate: form.fromDate,
      toDate: form.toDate,
      isHalfDay: String(form.isHalfDay),
    });
    setPreview(await api(`/leave/preview?${q}`));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/leave', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          substitutePersonId: form.substitutePersonId || null,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <AppShell>
      <h1>My Leave</h1>
      {error && <div className="error">{error}</div>}
      <div className="grid grid-3" style={{ marginTop: '1rem' }}>
        {balances.map((b) => (
          <div className="card" key={String(b.id)}>
            <div className="muted">{String(b.leaveType)}</div>
            <div className="stat">{String(b.balance)}</div>
            <div className="muted">Taken {String(b.taken)}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-2" style={{ marginTop: '1rem' }}>
        <form className="card" onSubmit={submit}>
          <h3>Apply for leave</h3>
          <label className="field">
            From
            <input
              type="date"
              value={form.fromDate}
              onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
              onBlur={refreshPreview}
              required
            />
          </label>
          <label className="field">
            To
            <input
              type="date"
              value={form.toDate}
              onChange={(e) => setForm({ ...form, toDate: e.target.value })}
              onBlur={refreshPreview}
              required
            />
          </label>
          <label className="field">
            Type
            <select
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
            >
              <option value="casual">Casual</option>
              <option value="sick">Sick</option>
              <option value="earned">Earned</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label className="field">
            Reason
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
            />
          </label>
          {preview && (
            <p>
              Days counted (incl. sandwich rules): <strong>{preview.daysCounted}</strong>
              {preview.conflict ? (
                <span className="badge warn" style={{ marginLeft: 8 }}>
                  Workshop conflict — substitute required
                </span>
              ) : null}
            </p>
          )}
          {preview?.conflict ? (
            <label className="field">
              Substitute person ID
              <input
                value={form.substitutePersonId}
                onChange={(e) => setForm({ ...form, substitutePersonId: e.target.value })}
              />
            </label>
          ) : null}
          <button className="btn" type="submit">
            Submit request
          </button>
        </form>
        <div className="card">
          <h3>History</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Dates</th>
                <th>Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={String(r.id)}>
                  <td>
                    {new Date(String(r.fromDate)).toLocaleDateString('en-IN')} –{' '}
                    {new Date(String(r.toDate)).toLocaleDateString('en-IN')}
                  </td>
                  <td>{String(r.daysCounted)}</td>
                  <td>
                    <span className="badge">{String(r.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
