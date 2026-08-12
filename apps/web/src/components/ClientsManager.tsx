'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { PageLoader, useLoading } from '@/lib/loading';
import { useAuth } from '@/lib/auth';
import { FormModal } from '@/components/FormModal';

type ClientRow = {
  id: string;
  name: string;
  clientType: string;
  city: string;
  state: string;
  board?: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  source?: string | null;
  lifecycleStatus?: string;
  _count?: { opportunities: number; workshops: number; engagements: number };
};

const emptyForm = {
  name: '',
  clientType: 'school',
  city: '',
  state: '',
  board: 'Not applicable',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  source: '',
};

type Props = {
  title?: string;
  backHref?: string;
  backLabel?: string;
};

export function ClientsManager({
  title = 'Clients',
  backHref,
  backLabel = 'Back',
}: Props) {
  const { user } = useAuth();
  const { confirm } = useLoading();
  const canManage =
    user?.team === 'sales' || user?.role === 'administrator' || user?.role === 'owner';

  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [q, setQ] = useState('');
  const [showLost, setShowLost] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load(search = q) {
    setLoading(true);
    try {
      const path = search.trim() ? `/clients?q=${encodeURIComponent(search.trim())}` : '/clients';
      setRows(await api(path, { loadingLabel: 'Loading clients…' }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () => rows.filter((r) => showLost || r.lifecycleStatus !== 'lost'),
    [rows, showLost],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(c: ClientRow) {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      clientType: c.clientType || 'school',
      city: c.city || '',
      state: c.state || '',
      board: c.board === 'Not_applicable' ? 'Not applicable' : c.board || 'Not applicable',
      contactPerson: c.contactPerson || '',
      contactPhone: c.contactPhone || '',
      contactEmail: c.contactEmail || '',
      source: c.source || '',
    });
    setFormError('');
    setModalOpen(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function submitPayload(overrideDuplicate = false, currentEditingId = editingId) {
    const payload = {
      ...form,
      contactEmail: form.contactEmail || null,
      overrideDuplicate,
      duplicateReason: overrideDuplicate ? 'Confirmed duplicate override from UI' : undefined,
    };
    if (currentEditingId) {
      await api(`/clients/${currentEditingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        loadingLabel: 'Updating client…',
      });
    } else {
      await api('/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
        loadingLabel: 'Creating client…',
      });
    }
    closeModal(true);
    await load();
  }

  async function save(_e: FormEvent) {
    if (!canManage) return;
    setSaving(true);
    setFormError('');
    const currentEditingId = editingId;
    try {
      await submitPayload(false, currentEditingId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const existingName =
          err.data.client && typeof err.data.client === 'object'
            ? String((err.data.client as { name?: string }).name || '')
            : '';
        confirm({
          title: 'Possible duplicate',
          message: `${err.message}${existingName ? ` Existing: ${existingName}.` : ''} Create/update anyway?`,
          confirmLabel: 'Override',
          onConfirm: async () => {
            await submitPayload(true, currentEditingId);
          },
        });
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed');
      }
    } finally {
      setSaving(false);
    }
  }

  function remove(c: ClientRow) {
    if (!canManage) return;
    const linked =
      (c._count?.opportunities || 0) + (c._count?.workshops || 0) + (c._count?.engagements || 0);
    confirm({
      title: linked > 0 ? 'Mark client as lost?' : 'Remove client?',
      message:
        linked > 0
          ? `${c.name} has linked opportunities/workshops. It will be marked as lost (not hard-deleted).`
          : `Mark ${c.name} as lost? You can still show lost clients with the filter.`,
      confirmLabel: linked > 0 ? 'Mark lost' : 'Remove',
      danger: true,
      onConfirm: async () => {
        await api(`/clients/${c.id}`, {
          method: 'DELETE',
          loadingLabel: 'Removing client…',
        });
        if (editingId === c.id) closeModal();
        await load();
      },
    });
  }

  function restore(c: ClientRow) {
    if (!canManage) return;
    confirm({
      title: 'Restore client?',
      message: `Mark ${c.name} as an active client again?`,
      confirmLabel: 'Restore',
      onConfirm: async () => {
        await api(`/clients/${c.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: c.name,
            clientType: c.clientType,
            city: c.city,
            state: c.state,
            board: c.board === 'Not_applicable' ? 'Not applicable' : c.board || 'Not applicable',
            contactPerson: c.contactPerson,
            contactPhone: c.contactPhone,
            contactEmail: c.contactEmail,
            source: c.source,
            lifecycleStatus: 'active_client',
          }),
          loadingLabel: 'Restoring client…',
        });
        await load();
      },
    });
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {backHref && (
          <Link href={backHref} className="muted">
            ← {backLabel}
          </Link>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {!canManage && (
        <p className="muted">
          Your role can view clients used for workshops; commercial fields are limited.
        </p>
      )}

      <div className="page-toolbar">
        <div className="toolbar-left">
          <input
            placeholder="Search name, city, contact…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <button
            className="btn secondary"
            type="button"
            onClick={() => load().catch((e) => setError(e.message))}
          >
            Search
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showLost}
              onChange={(e) => setShowLost(e.target.checked)}
            />
            Show lost
          </label>
        </div>
        {canManage && (
          <div className="toolbar-right">
            <button className="btn" type="button" onClick={openCreate}>
              + Add client
            </button>
          </div>
        )}
      </div>

      <div className="card list-panel">
        {loading ? (
          <PageLoader label="Loading clients…" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Contact</th>
                  <th>Status</th>
                  {canManage && <th>Links</th>}
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.clientType}</td>
                    <td>
                      {c.city}
                      {c.state ? `, ${c.state}` : ''}
                    </td>
                    <td>
                      {c.contactPerson || '—'}
                      {c.contactPhone ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {c.contactPhone}
                        </div>
                      ) : null}
                    </td>
                    <td>{c.lifecycleStatus || '—'}</td>
                    {canManage && (
                      <td>
                        {(c._count?.opportunities || 0) +
                          (c._count?.workshops || 0) +
                          (c._count?.engagements || 0)}
                      </td>
                    )}
                    {canManage && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn secondary" type="button" onClick={() => openEdit(c)}>
                          Edit
                        </button>{' '}
                        {c.lifecycleStatus === 'lost' ? (
                          <button className="btn" type="button" onClick={() => restore(c)}>
                            Restore
                          </button>
                        ) : (
                          <button className="btn danger" type="button" onClick={() => remove(c)}>
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={canManage ? 7 : 5} className="muted">
                      No clients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormModal
        open={modalOpen}
        title={editingId ? 'Edit client' : 'Add client'}
        subtitle={editingId ? 'Update client details' : 'Create a client for pipeline and workshops'}
        onClose={closeModal}
        onSubmit={save}
        submitLabel={editingId ? 'Update' : 'Create'}
        saving={saving}
        error={formError}
        wide
      >
        <label className="field">
          Name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            disabled={saving}
          />
        </label>
        <label className="field">
          Type
          <select
            value={form.clientType}
            onChange={(e) => setForm({ ...form, clientType: e.target.value })}
            disabled={saving}
          >
            <option value="school">School</option>
            <option value="community">Community</option>
            <option value="retail">Retail</option>
            <option value="corporate">Corporate</option>
          </select>
        </label>
        <label className="field">
          City
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
            disabled={saving}
          />
        </label>
        <label className="field">
          State
          <input
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            required
            disabled={saving}
          />
        </label>
        <label className="field">
          Board
          <select
            value={form.board}
            onChange={(e) => setForm({ ...form, board: e.target.value })}
            disabled={saving}
          >
            <option value="Not applicable">Not applicable</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="State">State</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="field">
          Contact person
          <input
            value={form.contactPerson}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            disabled={saving}
          />
        </label>
        <label className="field">
          Contact phone
          <input
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            disabled={saving}
          />
        </label>
        <label className="field">
          Contact email
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            disabled={saving}
          />
        </label>
        <label className="field">
          Source
          <input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            disabled={saving}
          />
        </label>
      </FormModal>
    </>
  );
}
