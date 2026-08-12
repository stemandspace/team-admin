'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { FormModal } from '@/components/FormModal';
import { api } from '@/lib/api';
import { PageLoader } from '@/lib/loading';

const emptyForm = {
  clientId: '',
  programId: '',
  expectedValue: 50000,
  expectedStudents: 100,
};

export default function SalesPage() {
  const [opps, setOpps] = useState<Array<Record<string, unknown>>>([]);
  const [programs, setPrograms] = useState<Array<Record<string, unknown>>>([]);
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      setOpps(await api('/sales/opportunities', { loadingLabel: 'Loading pipeline…' }));
      setPrograms(await api('/sales/programs', { silent: true }));
      const allClients = await api<Array<Record<string, unknown>>>('/clients', { silent: true });
      setClients(allClients.filter((c) => c.lifecycleStatus !== 'lost'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;
    setModalOpen(false);
    setForm(emptyForm);
    setFormError('');
  }

  async function createOpp(_e: FormEvent) {
    setSaving(true);
    setFormError('');
    try {
      await api('/sales/opportunities', {
        method: 'POST',
        body: JSON.stringify(form),
        loadingLabel: 'Creating opportunity…',
      });
      closeModal(true);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed');
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
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <h1 style={{ margin: 0 }}>Sales Pipeline</h1>
          <Link href="/sales/clients">Clients</Link>
          <Link href="/sales/programs">Programs</Link>
        </div>
        <div className="toolbar-right">
          <button className="btn" type="button" onClick={openCreate} disabled={loading}>
            + New opportunity
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <PageLoader label="Loading sales pipeline…" />
      ) : (
        <div className="card list-panel">
          <div className="table-wrap">
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
                {!opps.length && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No opportunities yet. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal
        open={modalOpen}
        title="New opportunity"
        subtitle="Link a client and program to open a pipeline item"
        onClose={() => closeModal()}
        onSubmit={createOpp}
        submitLabel="Create"
        saving={saving}
        error={formError}
      >
        <label className="field">
          Client{' '}
          <Link href="/sales/clients" style={{ fontWeight: 400, fontSize: 13 }}>
            Manage clients
          </Link>
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
          Program{' '}
          <Link href="/sales/programs" style={{ fontWeight: 400, fontSize: 13 }}>
            Manage programs
          </Link>
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
    </AppShell>
  );
}
