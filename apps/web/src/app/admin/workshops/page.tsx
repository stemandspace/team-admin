'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { FormModal } from '@/components/FormModal';
import { api } from '@/lib/api';
import { PageLoader } from '@/lib/loading';

const emptyWorkshop = {
  title: '',
  clientId: '',
  city: 'Pune',
  scheduledDate: '',
  startTime: '10:00',
  endTime: '12:00',
  workshopCategory: 'school_paid',
  gradeOrBand: '6-8',
  expectedStudents: 60,
};

export default function AdminWorkshopsPage() {
  const [workshops, setWorkshops] = useState<Array<Record<string, unknown>>>([]);
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);
  const [people, setPeople] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [form, setForm] = useState(emptyWorkshop);
  const [allocateId, setAllocateId] = useState('');
  const [personId, setPersonId] = useState('');

  async function load() {
    setLoading(true);
    try {
      setWorkshops(await api('/workshops', { loadingLabel: 'Loading workshops…' }));
      const allClients = await api<Array<Record<string, unknown>>>('/clients', { silent: true });
      setClients(allClients.filter((c) => c.lifecycleStatus !== 'lost'));
      setPeople(await api('/people', { silent: true }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  function openCreate() {
    setForm(emptyWorkshop);
    setFormError('');
    setCreateOpen(true);
  }

  function closeCreate(force = false) {
    if (saving && !force) return;
    setCreateOpen(false);
    setForm(emptyWorkshop);
    setFormError('');
  }

  function openAllocate(workshopId?: string) {
    setAllocateId(workshopId || '');
    setPersonId('');
    setFormError('');
    setAllocateOpen(true);
  }

  function closeAllocate(force = false) {
    if (saving && !force) return;
    setAllocateOpen(false);
    setAllocateId('');
    setPersonId('');
    setFormError('');
  }

  async function createWorkshop(_e: FormEvent) {
    setSaving(true);
    setFormError('');
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
        loadingLabel: 'Creating workshop…',
      });
      closeCreate(true);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function allocate(_e: FormEvent) {
    setSaving(true);
    setFormError('');
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
        loadingLabel: 'Allocating facilitator…',
      });
      closeAllocate(true);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <h1 style={{ margin: 0 }}>Workshop Scheduler</h1>
          <Link href="/admin/clients">Clients</Link>
        </div>
        <div className="toolbar-right">
          <button className="btn secondary" type="button" onClick={() => openAllocate()} disabled={loading}>
            Allocate
          </button>
          <button className="btn" type="button" onClick={openCreate} disabled={loading}>
            + Create workshop
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      {loading ? (
        <PageLoader label="Loading workshops…" />
      ) : (
        <div className="card list-panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Allocation</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {workshops.map((w) => (
                  <tr key={String(w.id)}>
                    <td>{String(w.title)}</td>
                    <td>{new Date(String(w.scheduledDate)).toLocaleDateString('en-IN')}</td>
                    <td>{String(w.status)}</td>
                    <td>{String(w.allocationStatus)}</td>
                    <td>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => openAllocate(String(w.id))}
                      >
                        Allocate
                      </button>
                    </td>
                  </tr>
                ))}
                {!workshops.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No workshops yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal
        open={createOpen}
        title="Create workshop"
        subtitle="Schedule a delivery and optionally link a client"
        onClose={() => closeCreate()}
        onSubmit={createWorkshop}
        submitLabel="Create"
        saving={saving}
        error={formError}
        wide
      >
        <label className="field">
          Title
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            disabled={saving}
          />
        </label>
        <label className="field">
          Client{' '}
          <Link href="/admin/clients" style={{ fontWeight: 400, fontSize: 13 }}>
            Manage clients
          </Link>
          <select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            disabled={saving}
          >
            <option value="">None</option>
            {clients.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          City
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            disabled={saving}
          />
        </label>
        <label className="field">
          Date
          <input
            type="date"
            value={form.scheduledDate}
            onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
            required
            disabled={saving}
          />
        </label>
        <label className="field">
          Start time
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            disabled={saving}
          />
        </label>
        <label className="field">
          End time
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            disabled={saving}
          />
        </label>
        <label className="field">
          Category
          <select
            value={form.workshopCategory}
            onChange={(e) => setForm({ ...form, workshopCategory: e.target.value })}
            disabled={saving}
          >
            <option value="school_paid">school_paid</option>
            <option value="community_paid">community_paid</option>
            <option value="retail_paid">retail_paid</option>
            <option value="corporate_paid">corporate_paid</option>
            <option value="demo_free">demo_free</option>
          </select>
        </label>
        <label className="field">
          Grade / band
          <input
            value={form.gradeOrBand}
            onChange={(e) => setForm({ ...form, gradeOrBand: e.target.value })}
            disabled={saving}
          />
        </label>
        <label className="field">
          Expected students
          <input
            type="number"
            value={form.expectedStudents}
            onChange={(e) => setForm({ ...form, expectedStudents: Number(e.target.value) })}
            disabled={saving}
          />
        </label>
      </FormModal>

      <FormModal
        open={allocateOpen}
        title="Allocate facilitator"
        subtitle="Assign a primary educator and finalize allocation"
        onClose={() => closeAllocate()}
        onSubmit={allocate}
        submitLabel="Allocate & finalize"
        saving={saving}
        error={formError}
      >
        <label className="field">
          Workshop
          <select
            value={allocateId}
            onChange={(e) => setAllocateId(e.target.value)}
            required
            disabled={saving}
          >
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
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            required
            disabled={saving}
          >
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
      </FormModal>
    </AppShell>
  );
}
