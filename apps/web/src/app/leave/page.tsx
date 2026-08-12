'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { FormModal } from '@/components/FormModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageLoader, useLoading } from '@/lib/loading';

const emptyForm = {
  fromDate: '',
  toDate: '',
  leaveType: 'casual',
  isHalfDay: false,
  reason: '',
  substitutePersonId: '',
};

export default function LeavePage() {
  const { user } = useAuth();
  const { confirm } = useLoading();
  const isAdmin = user?.role === 'administrator' || user?.role === 'owner';

  const [balances, setBalances] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [preview, setPreview] = useState<{ daysCounted: number; conflict: unknown } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [scopeAll, setScopeAll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function load(asAdmin = scopeAll) {
    setLoading(true);
    setError('');
    try {
      setBalances(await api('/leave/balances', { silent: true }));
      setRequests(
        await api(asAdmin && isAdmin ? '/leave?scope=all' : '/leave', {
          loadingLabel: 'Loading leave…',
        }),
      );
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

  function openApply() {
    setForm(emptyForm);
    setPreview(null);
    setFormError('');
    setModalOpen(true);
  }

  function closeModal(force = false) {
    if (submitting && !force) return;
    setModalOpen(false);
    setForm(emptyForm);
    setPreview(null);
    setFormError('');
  }

  async function refreshPreview(next = form) {
    if (!next.fromDate || !next.toDate) return;
    setPreviewing(true);
    try {
      const q = new URLSearchParams({
        fromDate: next.fromDate,
        toDate: next.toDate,
        isHalfDay: String(next.isHalfDay),
      });
      setPreview(await api(`/leave/preview?${q}`, { silent: true }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function submit(_e: FormEvent) {
    setFormError('');
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
      closeModal(true);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRequest(id: string) {
    confirm({
      title: 'Delete leave request?',
      message:
        'This cannot be undone. Pending requests are cancelled; admins deleting approved leave will restore balances.',
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
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <div>
            <h1 style={{ margin: 0 }}>
              {isAdmin && scopeAll ? 'All leave requests' : 'My Leave'}
            </h1>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              Pending requests can be cancelled. Admins can remove any request.
            </p>
          </div>
        </div>
        <div className="toolbar-right">
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
          <button className="btn" type="button" onClick={openApply} disabled={loading}>
            + Apply leave
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <PageLoader label="Loading leave data…" />
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
            {balances.map((b) => (
              <div className="card" key={String(b.id)}>
                <div className="muted">{String(b.leaveType)}</div>
                <div className="stat">{String(b.balance)}</div>
                <div className="muted">Taken {String(b.taken)}</div>
              </div>
            ))}
          </div>

          <div className="card list-panel">
            <h3 style={{ marginTop: 0 }}>History</h3>
            <div className="table-wrap">
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

      <FormModal
        open={modalOpen}
        title="Apply for leave"
        subtitle="Preview days counted before submitting"
        onClose={() => closeModal()}
        onSubmit={submit}
        submitLabel="Submit request"
        saving={submitting || previewing}
        error={formError}
      >
        <label className="field">
          From
          <input
            type="date"
            value={form.fromDate}
            onChange={(e) => {
              const next = { ...form, fromDate: e.target.value };
              setForm(next);
            }}
            onBlur={() => refreshPreview()}
            required
            disabled={submitting}
          />
        </label>
        <label className="field">
          To
          <input
            type="date"
            value={form.toDate}
            onChange={(e) => {
              const next = { ...form, toDate: e.target.value };
              setForm(next);
            }}
            onBlur={() => refreshPreview()}
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
      </FormModal>
    </AppShell>
  );
}
