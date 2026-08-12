'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function PeoplePage() {
  const [people, setPeople] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    employeeCode: '',
    email: '',
    team: 'academic',
    role: 'employee',
    baseCity: 'Pune',
    dateOfJoining: new Date().toISOString().slice(0, 10),
    password: 'Demo123!',
  });

  async function load() {
    setPeople(await api('/people'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/people', { method: 'POST', body: JSON.stringify(form) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function deactivate(id: string) {
    const res = await api<Record<string, unknown>>(`/people/${id}/deactivate`, {
      method: 'PATCH',
    });
    alert(`Deactivated. Handover items: ${JSON.stringify(res.handover)}`);
    await load();
  }

  return (
    <AppShell>
      <h1>People</h1>
      {error && <div className="error">{error}</div>}
      <div className="grid grid-2">
        <form className="card" onSubmit={create}>
          <h3>Add user</h3>
          {(['fullName', 'employeeCode', 'email', 'baseCity', 'password'] as const).map((k) => (
            <label className="field" key={k}>
              {k}
              <input
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                required
              />
            </label>
          ))}
          <label className="field">
            Team
            <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
              <option value="sales">Sales</option>
              <option value="academic">Academic</option>
              <option value="support">Support</option>
            </select>
          </label>
          <label className="field">
            Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="employee">Employee</option>
              <option value="administrator">Administrator</option>
            </select>
          </label>
          <button className="btn" type="submit">
            Create
          </button>
        </form>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Team</th>
                <th>Role</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={String(p.id)}>
                  <td>{String(p.fullName)}</td>
                  <td>{String(p.team)}</td>
                  <td>{String(p.role)}</td>
                  <td>{p.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    {Boolean(p.isActive) && p.role !== 'owner' && (
                      <button className="btn danger" onClick={() => deactivate(String(p.id))}>
                        Deactivate
                      </button>
                    )}
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
