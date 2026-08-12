'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function SalesPage() {
  const [opps, setOpps] = useState<Array<Record<string, unknown>>>([]);
  const [programs, setPrograms] = useState<Array<Record<string, unknown>>>([]);
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    clientId: '',
    programId: '',
    expectedValue: 50000,
    expectedStudents: 100,
  });

  async function load() {
    setOpps(await api('/sales/opportunities'));
    setPrograms(await api('/sales/programs'));
    setClients(await api('/clients'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createOpp(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/sales/opportunities', { method: 'POST', body: JSON.stringify(form) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function setStage(id: string, stage: string) {
    try {
      await api(`/sales/opportunities/${id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <AppShell>
      <h1>Sales Pipeline</h1>
      {error && <div className="error">{error}</div>}
      <div className="grid grid-2">
        <form className="card" onSubmit={createOpp}>
          <h3>New opportunity</h3>
          <label className="field">
            Client
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              required
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
            />
          </label>
          <button className="btn" type="submit">
            Create
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
                        <button className="btn secondary" onClick={() => setStage(String(o.id), 'registered')}>
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
    </AppShell>
  );
}
