'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageLoader, useLoading } from '@/lib/loading';

export default function LeavePage() {
  const { user } = useAuth();
  const { confirm } = useLoading();
  const isAdmin = user?.role === 'administrator' || user?.role === 'owner';

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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [scopeAll, setScopeAll] = useState(false);

  async function load(asAdmin = scopeAll) {
    setLoading(true);
    setError('');
    try {
      setBalances(await api('/leave/balances'));
      setRequests(await api(asAdmin && isAdmin ? '/leave?scope=all' : '/leave'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leave');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshPreview() {
    if (!form.fromDate || !form.toDate) return;
    setPreviewing(true);
    try {
      const q = new URLSearchParams({
        fromDate: form.fromDate,
        toDate: form.toDate,
        isHalfDay: String(form.isHalfDay),
      });
      setPreview(await api(`/leave/preview?${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/leave', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          substitutePersonId: form.substitutePersonId || null,
        }),
        loadingLabel: 'Submitting leave request…',
      });
      setForm({
        fromDate: '',
        toDate: '',
        leaveType: 'casual',
        isHalfDay: false,
        reason: '',
        substitutePersonId: '',
      });
      setPreview(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRequest(id: string) {
    confirm({
      title: 'Delete leave request?',
      message: 'This cannot be undone. Pending requests are cancelled; admins deleting approved leave will restore balances.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setDeletingId(id);
        setError('');
        try {
          await api(`/leave/${id}`, {
            method: 'DELETE',
            loadingLabel: 'Deleting leave request…',
          });
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Delete failed');
          throw err;
        } finally {
          setDeletingId(null);
        }
      },
    });
  }

  function canDelete(r: Record<string, unknown>) {
    if (isAdmin) return true;
    return r.status === 'pending' && String(r.personId || '') === user?.id;
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>{isAdmin && scopeAll ? 'All leave requests' : 'My Leave'}</h1>
          <p className="muted">Pending requests can be cancelled. Admins can remove any request.</p>
        </div>
        {isAdmin && (
          <button
            className="btn secondary"
            disabled={loading}
            onClick={() => {
              const next = !scopeAll;
              setScopeAll(next);
              load(next);
            }}
          >
            {scopeAll ? 'Show mine' : 'Show all (admin)'}
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <PageLoader label="Loading leave data…" />
      ) : (
        <>
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
                  disabled={submitting}
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
                  disabled={submitting}
                />
              </label>
              <label className="field">
                Type
                <select
                  value={form.leaveType}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                  disabled={submitting}
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
                  disabled={submitting}
                />
              </label>
              {previewing && (
                <p className="muted">
                  <span className="spinner" /> Calculating days…
                </p>
              )}
              {preview && !previewing && (
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
                    disabled={submitting}
                  />
                </label>
              ) : null}
              <button className="btn" type="submit" disabled={submitting || previewing}>
                {submitting ? (
                  <>
                    <span className="spinner light" style={{ marginRight: 8 }} />
                    Submitting…
                  </>
                ) : (
                  'Submit request'
                )}
              </button>
            </form>

            <div className="card">
              <h3>History</h3>
              <table className="table">
                <thead>
                  <tr>
                    {scopeAll && <th>Person</th>}
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={scopeAll ? 5 : 4} className="muted">
                        No leave requests yet
                      </td>
                    </tr>
                  )}
                  {requests.map((r) => {
                    const person = r.person as { fullName?: string } | undefined;
                    const id = String(r.id);
                    const busy = deletingId === id;
                    return (
                      <tr key={id}>
                        {scopeAll && <td>{person?.fullName || '—'}</td>}
                        <td>
                          {new Date(String(r.fromDate)).toLocaleDateString('en-IN')} –{' '}
                          {new Date(String(r.toDate)).toLocaleDateString('en-IN')}
                        </td>
                        <td>{String(r.daysCounted)}</td>
                        <td>
                          <span className="badge">{String(r.status)}</span>
                        </td>
                        <td>
                          {canDelete(r) && (
                            <button
                              type="button"
                              className="btn danger"
                              disabled={busy || submitting}
                              onClick={() => removeRequest(id)}
                            >
                              {busy ? (
                                <>
                                  <span className="spinner light" style={{ marginRight: 6 }} />
                                  Deleting…
                                </>
                              ) : (
                                'Delete'
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
