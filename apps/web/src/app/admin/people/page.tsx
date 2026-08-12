'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { FormModal } from '@/components/FormModal';
import { api } from '@/lib/api';
import { PageLoader, useLoading } from '@/lib/loading';

const emptyForm = {
  fullName: '',
  employeeCode: '',
  email: '',
  team: 'academic',
  role: 'employee',
  baseCity: 'Pune',
  dateOfJoining: new Date().toISOString().slice(0, 10),
  password: 'Demo123!',
};

export default function PeoplePage() {
  const { confirm } = useLoading();
  const [people, setPeople] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      setPeople(await api('/people', { loadingLabel: 'Loading people…' }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  function openCreate() {
    setForm({
      ...emptyForm,
      dateOfJoining: new Date().toISOString().slice(0, 10),
    });
    setFormError('');
    setModalOpen(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;
    setModalOpen(false);
    setForm(emptyForm);
    setFormError('');
  }

  async function create(_e: FormEvent) {
    setSaving(true);
    setFormError('');
    try {
      await api('/people', {
        method: 'POST',
        body: JSON.stringify(form),
        loadingLabel: 'Creating user…',
      });
      closeModal(true);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function deactivate(id: string, name: string) {
    confirm({
      title: 'Deactivate user?',
      message: `Deactivate ${name}? Handover items will be returned.`,
      confirmLabel: 'Deactivate',
      danger: true,
      onConfirm: async () => {
        const res = await api<Record<string, unknown>>(`/people/${id}/deactivate`, {
          method: 'PATCH',
          loadingLabel: 'Deactivating…',
        });
        alert(`Deactivated. Handover items: ${JSON.stringify(res.handover)}`);
        await load();
      },
    });
  }

  return (
    <AppShell>
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <h1 style={{ margin: 0 }}>People</h1>
        </div>
        <div className="toolbar-right">
          <button className="btn" type="button" onClick={openCreate} disabled={loading}>
            + Add user
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      {loading ? (
        <PageLoader label="Loading people…" />
      ) : (
        <div className="card list-panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
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
                    <td>{String(p.email || '—')}</td>
                    <td>{String(p.team)}</td>
                    <td>{String(p.role)}</td>
                    <td>{p.isActive ? 'Yes' : 'No'}</td>
                    <td>
                      {Boolean(p.isActive) && p.role !== 'owner' && (
                        <button
                          className="btn danger"
                          type="button"
                          onClick={() => deactivate(String(p.id), String(p.fullName))}
                        >
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
      )}

      <FormModal
        open={modalOpen}
        title="Add user"
        subtitle="Create a person account for Team Admin"
        onClose={() => closeModal()}
        onSubmit={create}
        submitLabel="Create"
        saving={saving}
        error={formError}
        wide
      >
        {(['fullName', 'employeeCode', 'email', 'baseCity', 'password'] as const).map((k) => (
          <label className="field" key={k}>
            {k}
            <input
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              required
              disabled={saving}
            />
          </label>
        ))}
        <label className="field">
          Date of joining
          <input
            type="date"
            value={form.dateOfJoining}
            onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
            required
            disabled={saving}
          />
        </label>
        <label className="field">
          Team
          <select
            value={form.team}
            onChange={(e) => setForm({ ...form, team: e.target.value })}
            disabled={saving}
          >
            <option value="sales">Sales</option>
            <option value="academic">Academic</option>
            <option value="support">Support</option>
          </select>
        </label>
        <label className="field">
          Role
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            disabled={saving}
          >
            <option value="employee">Employee</option>
            <option value="administrator">Administrator</option>
          </select>
        </label>
      </FormModal>
    </AppShell>
  );
}
