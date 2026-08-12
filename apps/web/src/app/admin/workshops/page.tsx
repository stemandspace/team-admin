'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function AdminWorkshopsPage() {
  const [workshops, setWorkshops] = useState<Array<Record<string, unknown>>>([]);
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);
  const [people, setPeople] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    clientId: '',
    city: 'Pune',
    scheduledDate: '',
    startTime: '10:00',
    endTime: '12:00',
    workshopCategory: 'school_paid',
    gradeOrBand: '6-8',
    expectedStudents: 60,
  });
  const [allocateId, setAllocateId] = useState('');
  const [personId, setPersonId] = useState('');

  async function load() {
    setWorkshops(await api('/workshops'));
    setClients(await api('/clients'));
    setPeople(await api('/people'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createWorkshop(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/workshops', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          clientId: form.clientId || null,
          city: form.city,
          scheduledDate: form.scheduledDate,
          startTime: form.startTime,
          endTime: form.endTime,
          workshopCategory: form.workshopCategory,
          revenueType: 'client_billed',
          mode: 'offline',
          locationType: 'within_city',
          grades: [
            {
              gradeOrBand: form.gradeOrBand,
              expectedStudents: form.expectedStudents,
            },
          ],
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function allocate() {
    try {
      await api(`/workshops/${allocateId}/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          finalize: true,
          assignments: [
            {
              personId,
              assignmentRole: 'primary_educator',
              travelRequired: false,
            },
          ],
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <AppShell>
      <h1>Workshop Scheduler</h1>
      {error && <div className="error">{error}</div>}
      <div className="grid grid-2">
        <form className="card" onSubmit={createWorkshop}>
          <h3>Create workshop</h3>
          <label className="field">
            Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label className="field">
            Client
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">None</option>
              {clients.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Date
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              required
            />
          </label>
          <label className="field">
            Expected students
            <input
              type="number"
              value={form.expectedStudents}
              onChange={(e) => setForm({ ...form, expectedStudents: Number(e.target.value) })}
            />
          </label>
          <button className="btn" type="submit">
            Create
          </button>
        </form>
        <div className="card">
          <h3>Allocate facilitator</h3>
          <label className="field">
            Workshop
            <select value={allocateId} onChange={(e) => setAllocateId(e.target.value)}>
              <option value="">Select</option>
              {workshops.map((w) => (
                <option key={String(w.id)} value={String(w.id)}>
                  {String(w.title)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Person
            <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Select</option>
              {people
                .filter((p) => p.team === 'academic' || p.team === 'support')
                .map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.fullName)}
                  </option>
                ))}
            </select>
          </label>
          <button className="btn" onClick={allocate}>
            Allocate & finalize
          </button>
        </div>
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Status</th>
              <th>Allocation</th>
            </tr>
          </thead>
          <tbody>
            {workshops.map((w) => (
              <tr key={String(w.id)}>
                <td>{String(w.title)}</td>
                <td>{new Date(String(w.scheduledDate)).toLocaleDateString('en-IN')}</td>
                <td>{String(w.status)}</td>
                <td>{String(w.allocationStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
