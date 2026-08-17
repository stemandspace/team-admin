'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { FormModal } from '@/components/FormModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageLoader, useLoading } from '@/lib/loading';

export default function SalesLeavePage() {
  const { user } = useAuth();
  const { confirm } = useLoading();
  const isOwner = user?.role === 'owner' || user?.role === 'administrator';
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    startDateTime: '',
    endDateTime: '',
    reason: '',
  });

  async function load() {
    setLoading(true);
    try {
      const path = isOwner ? '/sales/unavailability?scope=all' : '/sales/unavailability';
      setRows(await api(path, { loadingLabel: 'Loading leave…' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(_e: FormEvent) {
    setSaving(true);
    setFormError('');
    try {
      await api('/sales/unavailability', {
        method: 'POST',
        body: JSON.stringify(form),
        loadingLabel: 'Submitting…',
      });
      setOpen(false);
      setForm({ startDateTime: '', endDateTime: '', reason: '' });
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function review(id: string, status: 'approved' | 'rejected') {
    confirm({
      title: `${status === 'approved' ? 'Approve' : 'Reject'} leave?`,
      message: 'Approved periods exempt daily sales reporting for that window only.',
      confirmLabel: status === 'approved' ? 'Approve' : 'Reject',
      danger: status === 'rejected',
      onConfirm: async () => {
        await api(`/sales/unavailability/${id}/review`, {
          method: 'POST',
          body: JSON.stringify({ status }),
          loadingLabel: 'Updating…',
        });
        await load();
      },
    });
  }

  return (
    <AppShell>
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <h1 style={{ margin: 0 }}>Leave / Unavailability</h1>
          <Link href="/sales">← Pipeline</Link>
        </div>
        <div className="toolbar-right">
          <button className="btn" type="button" onClick={() => setOpen(true)}>
            + Request leave
          </button>
        </div>
      </div>
      <p className="muted">
        Request any period including hourly slots. Owner approves/rejects. Past periods require Owner
        intervention.
      </p>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <PageLoader label="Loading…" />
      ) : (
        <div className="card list-panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {isOwner && <th>Person</th>}
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {isOwner && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    {isOwner && <td>{r.person?.fullName}</td>}
                    <td>
                      {r.startDateTime
                        ? new Date(r.startDateTime).toLocaleString('en-IN')
                        : new Date(r.fromDate).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      {r.endDateTime
                        ? new Date(r.endDateTime).toLocaleString('en-IN')
                        : new Date(r.toDate).toLocaleDateString('en-IN')}
                    </td>
                    <td>{r.reason}</td>
                    <td>
                      <span className="badge">{r.status}</span>
                    </td>
                    {isOwner && (
                      <td>
                        {r.status === 'pending' && (
                          <>
                            <button className="btn" type="button" onClick={() => review(String(r.id), 'approved')}>
                              Approve
                            </button>{' '}
                            <button
                              className="btn danger"
                              type="button"
                              onClick={() => review(String(r.id), 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={isOwner ? 6 : 4} className="muted">
                      No leave requests
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal
        open={open}
        title="Request leave / unavailability"
        subtitle="Covers 1 hour, half day, full day or multi-day"
        onClose={() => !saving && setOpen(false)}
        onSubmit={submit}
        submitLabel="Submit"
        saving={saving}
        error={formError}
      >
        <label className="field">
          Start
          <input
            type="datetime-local"
            value={form.startDateTime}
            onChange={(e) => setForm({ ...form, startDateTime: e.target.value })}
            required
          />
        </label>
        <label className="field">
          End
          <input
            type="datetime-local"
            value={form.endDateTime}
            onChange={(e) => setForm({ ...form, endDateTime: e.target.value })}
            required
          />
        </label>
        <label className="field">
          Reason
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            required
          />
        </label>
      </FormModal>
    </AppShell>
  );
}
