'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageLoader, useLoading } from '@/lib/loading';
import { useAuth } from '@/lib/auth';
import { FormModal } from '@/components/FormModal';

type ProgramRow = {
  id: string;
  name: string;
  programFamily: string;
  audience: string;
  deliveryModeSupported?: string;
  defaultPrice?: number | null;
  priceUnit?: string | null;
  mapsToWorkshopCategory?: string | null;
  isActive?: boolean;
  _count?: { opportunities: number; engagements: number; salesTargets: number };
};

const emptyForm = {
  name: '',
  programFamily: 'workshop',
  audience: 'school',
  deliveryModeSupported: 'both',
  defaultPrice: '',
  priceUnit: '',
  mapsToWorkshopCategory: 'school_paid',
};

type Props = {
  title?: string;
  backHref?: string;
  backLabel?: string;
};

export function ProgramsManager({
  title = 'Programs',
  backHref,
  backLabel = 'Back',
}: Props) {
  const { user } = useAuth();
  const { confirm } = useLoading();
  const canManage =
    user?.team === 'sales' || user?.role === 'administrator' || user?.role === 'owner';

  const [rows, setRows] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load(search = q) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ includeInactive: '1' });
      if (search.trim()) params.set('q', search.trim());
      setRows(await api(`/sales/programs?${params}`, { loadingLabel: 'Loading programs…' }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () => rows.filter((r) => showInactive || r.isActive !== false),
    [rows, showInactive],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(p: ProgramRow) {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      programFamily: p.programFamily || 'workshop',
      audience: p.audience || 'school',
      deliveryModeSupported: p.deliveryModeSupported || 'both',
      defaultPrice: p.defaultPrice != null ? String(p.defaultPrice) : '',
      priceUnit: p.priceUnit || '',
      mapsToWorkshopCategory: p.mapsToWorkshopCategory || '',
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

  async function save(_e: FormEvent) {
    if (!canManage) return;
    setSaving(true);
    setFormError('');
    const payload = {
      name: form.name,
      programFamily: form.programFamily,
      audience: form.audience,
      deliveryModeSupported: form.deliveryModeSupported,
      defaultPrice: form.defaultPrice === '' ? null : Number(form.defaultPrice),
      priceUnit: form.priceUnit || null,
      mapsToWorkshopCategory: form.mapsToWorkshopCategory || null,
      isActive: true,
    };
    try {
      if (editingId) {
        await api(`/sales/programs/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          loadingLabel: 'Updating program…',
        });
      } else {
        await api('/sales/programs', {
          method: 'POST',
          body: JSON.stringify(payload),
          loadingLabel: 'Creating program…',
        });
      }
      closeModal(true);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function deactivate(p: ProgramRow) {
    if (!canManage) return;
    const linked =
      (p._count?.opportunities || 0) +
      (p._count?.engagements || 0) +
      (p._count?.salesTargets || 0);
    confirm({
      title: 'Deactivate program?',
      message:
        linked > 0
          ? `${p.name} has linked opportunities/engagements. It will be deactivated (not hard-deleted).`
          : `Deactivate ${p.name}? Inactive programs are hidden from pipeline dropdowns.`,
      confirmLabel: 'Deactivate',
      danger: true,
      onConfirm: async () => {
        await api(`/sales/programs/${p.id}`, {
          method: 'DELETE',
          loadingLabel: 'Deactivating program…',
        });
        if (editingId === p.id) closeModal();
        await load();
      },
    });
  }

  function reactivate(p: ProgramRow) {
    if (!canManage) return;
    confirm({
      title: 'Reactivate program?',
      message: `Make ${p.name} active again for the sales pipeline?`,
      confirmLabel: 'Reactivate',
      onConfirm: async () => {
        await api(`/sales/programs/${p.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: p.name,
            programFamily: p.programFamily,
            audience: p.audience,
            deliveryModeSupported: p.deliveryModeSupported || 'both',
            defaultPrice: p.defaultPrice ?? null,
            priceUnit: p.priceUnit ?? null,
            mapsToWorkshopCategory: p.mapsToWorkshopCategory ?? null,
            isActive: true,
          }),
          loadingLabel: 'Reactivating program…',
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

      <div className="page-toolbar">
        <div className="toolbar-left">
          <input
            placeholder="Search programs…"
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
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
        {canManage && (
          <div className="toolbar-right">
            <button className="btn" type="button" onClick={openCreate}>
              + Add program
            </button>
          </div>
        )}
      </div>

      <div className="card list-panel">
        {loading ? (
          <PageLoader label="Loading programs…" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Family</th>
                  <th>Audience</th>
                  <th>Mode</th>
                  <th>Price</th>
                  <th>Status</th>
                  {canManage && <th>Links</th>}
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.programFamily}</td>
                    <td>{p.audience}</td>
                    <td>{p.deliveryModeSupported || '—'}</td>
                    <td>
                      {p.defaultPrice != null
                        ? `₹${Number(p.defaultPrice).toLocaleString('en-IN')}${
                            p.priceUnit ? ` / ${p.priceUnit}` : ''
                          }`
                        : '—'}
                    </td>
                    <td>{p.isActive === false ? 'inactive' : 'active'}</td>
                    {canManage && (
                      <td>
                        {(p._count?.opportunities || 0) +
                          (p._count?.engagements || 0) +
                          (p._count?.salesTargets || 0)}
                      </td>
                    )}
                    {canManage && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn secondary" type="button" onClick={() => openEdit(p)}>
                          Edit
                        </button>{' '}
                        {p.isActive === false ? (
                          <button className="btn" type="button" onClick={() => reactivate(p)}>
                            Reactivate
                          </button>
                        ) : (
                          <button className="btn danger" type="button" onClick={() => deactivate(p)}>
                            Deactivate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={canManage ? 8 : 6} className="muted">
                      No programs found.
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
        title={editingId ? 'Edit program' : 'Add program'}
        subtitle={editingId ? 'Update program catalog details' : 'Create a program for the sales pipeline'}
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
          Family
          <select
            value={form.programFamily}
            onChange={(e) => setForm({ ...form, programFamily: e.target.value })}
            disabled={saving}
          >
                  <option value="workshop">Workshop</option>
                  <option value="iasc">IASC</option>
                  <option value="nac">NAC</option>
                  <option value="explorium">Explorium</option>
                  <option value="project">Project</option>
                  <option value="olympiad">Olympiad</option>
                  <option value="challenge">Challenge</option>
                  <option value="other">Other</option>
          </select>
        </label>
        <label className="field">
          Audience
          <select
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            disabled={saving}
          >
            <option value="school">School</option>
            <option value="retail_direct_parent">Retail / direct parent</option>
          </select>
        </label>
        <label className="field">
          Delivery mode
          <select
            value={form.deliveryModeSupported}
            onChange={(e) => setForm({ ...form, deliveryModeSupported: e.target.value })}
            disabled={saving}
          >
            <option value="both">Both</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </label>
        <label className="field">
          Default price
          <input
            type="number"
            min={0}
            value={form.defaultPrice}
            onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
            disabled={saving}
          />
        </label>
        <label className="field">
          Price unit
          <input
            value={form.priceUnit}
            onChange={(e) => setForm({ ...form, priceUnit: e.target.value })}
            placeholder="per student / per workshop"
            disabled={saving}
          />
        </label>
        <label className="field">
          Maps to workshop category
          <select
            value={form.mapsToWorkshopCategory}
            onChange={(e) => setForm({ ...form, mapsToWorkshopCategory: e.target.value })}
            disabled={saving}
          >
            <option value="">None</option>
            <option value="school_paid">school_paid</option>
            <option value="community_paid">community_paid</option>
            <option value="retail_paid">retail_paid</option>
            <option value="corporate_paid">corporate_paid</option>
            <option value="csr_free">csr_free</option>
            <option value="demo_free">demo_free</option>
            <option value="youtube_open">youtube_open</option>
            <option value="spacetopia_open">spacetopia_open</option>
            <option value="internal_training">internal_training</option>
          </select>
        </label>
      </FormModal>
    </>
  );
}
