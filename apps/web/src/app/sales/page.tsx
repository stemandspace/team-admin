'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { PageLoader } from '@/lib/loading';

export default function SalesPage() {
  const [opps, setOpps] = useState<Array<Record<string, unknown>>>([]);
  const [programs, setPrograms] = useState<Array<Record<string, unknown>>>([]);
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clientId: '',
    programId: '',
    expectedValue: 50000,
    expectedStudents: 100,
  });

  async function load() {
    setLoading(true);
    try {
      setOpps(await api('/sales/opportunities', { loadingLabel: 'Loading pipeline…' }));
      setPrograms(await api('/sales/programs', { silent: true }));
      setClients(await api('/clients', { silent: true }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createOpp(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/sales/opportunities', {
        method: 'POST',
        body: JSON.stringify(form),
        loadingLabel: 'Creating opportunity…',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function setStage(id: string, stage: string) {
    setSaving(true);
    setError('');
    try {
      await api(`/sales/opportunities/${id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage }),
        loadingLabel: 'Updating stage…',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1>Sales Pipeline</h1>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <PageLoader label="Loading sales pipeline…" />
      ) : (
        <div className="grid grid-2">
          <form className="card" onSubmit={createOpp}>
            <h3>New opportunity</h3>
            <label className="field">
              Client
              <select
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                required
                disabled={saving}
              >
                <option value="">Select</option>
                {clients.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Program
              <select
                value={form.programId}
                onChange={(e) => setForm({ ...form, programId: e.target.value })}
                required
                disabled={saving}
              >
                <option value="">Select</option>
                {programs.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Expected value (₹)
              <input
                type="number"
                value={form.expectedValue}
                onChange={(e) => setForm({ ...form, expectedValue: Number(e.target.value) })}
                disabled={saving}
              />
            </label>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner light" style={{ marginRight: 8 }} />
                  Saving…
                </>
              ) : (
                'Create'
              )}
            </button>
          </form>
          <div className="card">
            <h3>Opportunities</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Stage</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {opps.map((o) => {
                  const client = o.client as { name: string };
                  return (
                    <tr key={String(o.id)}>
                      <td>{client?.name}</td>
                      <td>
                        <span className="badge">{String(o.stage)}</span>
                      </td>
                      <td>₹{Number(o.expectedValue).toLocaleString('en-IN')}</td>
                      <td>
                        {o.stage !== 'registered' && (
                          <button
                            className="btn secondary"
                            disabled={saving}
                            onClick={() => setStage(String(o.id), 'registered')}
                          >
                            Mark registered
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
      )}
    </AppShell>
  );
}
