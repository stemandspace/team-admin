'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { FormModal } from '@/components/FormModal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageLoader, useLoading } from '@/lib/loading';

const STAGES = [
  'lead',
  'contacted',
  'requirements',
  'proposal_sent',
  'follow_up',
  'won',
  'on_hold',
  'lost',
  'dead',
] as const;

const emptyForm = {
  clientId: '',
  programId: '',
  leadSource: 'outbound',
  probability: 25,
  expectedValue: 0,
  expectedStudents: 60,
  expectedRegistrations: 0,
  expectedCloseDate: '',
  nextAction: '',
  decisionMakerContactId: '',
  coordinatorContactId: '',
  mode: 'offline',
  durationMinutes: 90,
  workshopCount: 1,
  pricingModel: 'per_student',
};

type Opp = Record<string, any>;

export default function SalesPage() {
  const { user } = useAuth();
  const { confirm } = useLoading();
  const [opps, setOpps] = useState<Opp[]>([]);
  const [programs, setPrograms] = useState<Opp[]>([]);
  const [clients, setClients] = useState<Opp[]>([]);
  const [contacts, setContacts] = useState<Opp[]>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<Opp | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [scopeMine, setScopeMine] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [interaction, setInteraction] = useState({
    communicationMode: 'phone',
    interactionType: 'follow_up',
    outcome: 'positive',
    notes: '',
    nextAction: '',
    nextFollowUpDate: '',
    stageAfter: '',
  });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (scopeMine) params.set('mine', '1');
      if (stageFilter) params.set('stage', stageFilter);
      if (q.trim()) params.set('q', q.trim());
      setOpps(await api(`/sales/opportunities?${params}`, { loadingLabel: 'Loading pipeline…' }));
      setPrograms(await api('/sales/programs', { silent: true }));
      const allClients = await api<Opp[]>('/clients', { silent: true });
      setClients(allClients.filter((c) => c.lifecycleStatus !== 'lost'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeMine, stageFilter]);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === form.programId),
    [programs, form.programId],
  );

  async function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  async function onClientChange(clientId: string) {
    setForm((f) => ({ ...f, clientId, decisionMakerContactId: '', coordinatorContactId: '' }));
    if (!clientId) {
      setContacts([]);
      return;
    }
    setContacts(await api(`/sales/contacts?clientId=${clientId}`, { silent: true }));
  }

  async function createOpp(_e: FormEvent) {
    setSaving(true);
    setFormError('');
    try {
      const productConfig =
        selectedProgram?.programFamily === 'workshop'
          ? {
              mode: form.mode,
              durationMinutes: Number(form.durationMinutes),
              workshopCount: Number(form.workshopCount),
              pricingModel: form.pricingModel,
            }
          : undefined;

      await api('/sales/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          clientId: form.clientId,
          programId: form.programId,
          leadSource: form.leadSource,
          probability: Number(form.probability),
          expectedValue: Number(form.expectedValue),
          expectedStudents:
            selectedProgram?.programFamily === 'workshop' ? Number(form.expectedStudents) : null,
          expectedRegistrations: ['iasc', 'nac'].includes(String(selectedProgram?.programFamily))
            ? Number(form.expectedRegistrations)
            : null,
          expectedCloseDate: form.expectedCloseDate || null,
          nextAction: form.nextAction || null,
          decisionMakerContactId: form.decisionMakerContactId || null,
          coordinatorContactId: form.coordinatorContactId || null,
          productConfig,
        }),
        loadingLabel: 'Creating opportunity…',
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed');
      }
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id: string) {
    const row = await api(`/sales/opportunities/${id}`, { loadingLabel: 'Loading…' });
    setDetail(row);
  }

  async function setStage(id: string, stage: string) {
    if (stage === 'on_hold') {
      const reason = window.prompt('On Hold reason (required)');
      if (!reason) return;
      const month = window.prompt('Expected reopen month (YYYY-MM-01)', new Date().toISOString().slice(0, 8) + '01');
      await api(`/sales/opportunities/${id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage, onHoldReason: reason, onHoldReopenMonth: month }),
        loadingLabel: 'Updating stage…',
      });
    } else if (stage === 'lost' || stage === 'dead') {
      const reason = window.prompt('Lost/Dead reason');
      await api(`/sales/opportunities/${id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage, lostReason: reason || undefined }),
        loadingLabel: 'Updating stage…',
      });
    } else {
      await api(`/sales/opportunities/${id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage }),
        loadingLabel: 'Updating stage…',
      });
    }
    await load();
    if (detail?.id === id) await openDetail(id);
  }

  async function markProposalSent(id: string) {
    const amount = window.prompt('Proposal amount (₹)', String(detail?.expectedValue || 0));
    if (amount == null) return;
    await api(`/sales/opportunities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        markProposalSent: true,
        proposalAmount: Number(amount),
        proposalStatus: 'sent',
        stage: 'proposal_sent',
        probability: Math.max(Number(detail?.probability || 25), 50),
      }),
      loadingLabel: 'Recording proposal…',
    });
    await load();
    await openDetail(id);
  }

  async function submitInteraction(_e: FormEvent) {
    if (!detail) return;
    setSaving(true);
    setFormError('');
    try {
      await api('/sales/interactions', {
        method: 'POST',
        body: JSON.stringify({
          opportunityId: detail.id,
          ...interaction,
          stageAfter: interaction.stageAfter || null,
          nextFollowUpDate: interaction.nextFollowUpDate || null,
        }),
        loadingLabel: 'Logging interaction…',
      });
      setLogOpen(false);
      setInteraction({
        communicationMode: 'phone',
        interactionType: 'follow_up',
        outcome: 'positive',
        notes: '',
        nextAction: '',
        nextFollowUpDate: '',
        stageAfter: '',
      });
      await load();
      await openDetail(detail.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  const canEdit = (o: Opp) =>
    user?.role === 'owner' || user?.role === 'administrator' || o.ownerPersonId === user?.id;

  return (
    <AppShell>
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <h1 style={{ margin: 0 }}>Sales Pipeline</h1>
          <Link href="/sales/feed">Activity Feed</Link>
          <Link href="/sales/dashboard">Dashboard</Link>
        </div>
        <div className="toolbar-right">
          <button className="btn" type="button" onClick={openCreate} disabled={loading}>
            + New opportunity
          </button>
        </div>
      </div>

      <div className="page-toolbar">
        <div className="toolbar-left">
          <input
            placeholder="Search school / city / phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <button className="btn secondary" type="button" onClick={() => load()}>
            Search
          </button>
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={scopeMine} onChange={(e) => setScopeMine(e.target.checked)} />
            Mine only
          </label>
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
                  <th>Product</th>
                  <th>Owner</th>
                  <th>Stage</th>
                  <th>Prob</th>
                  <th>Expected</th>
                  <th>Weighted</th>
                  <th>Ageing</th>
                  <th>Alerts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {opps.map((o) => (
                  <tr key={String(o.id)}>
                    <td>
                      {o.client?.name}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {o.client?.city}
                        {o.client?.branch ? ` · ${o.client.branch}` : ''}
                      </div>
                    </td>
                    <td>{o.program?.name}</td>
                    <td>{o.owner?.fullName}</td>
                    <td>
                      <span className="badge">{o.stage}</span>
                    </td>
                    <td>{o.probability || 25}%</td>
                    <td>₹{Number(o.expectedValue || 0).toLocaleString('en-IN')}</td>
                    <td>₹{Number(o.weightedValue || 0).toLocaleString('en-IN')}</td>
                    <td>
                      {o.ageing?.dead ? (
                        <span className="badge warn">dead risk</span>
                      ) : o.ageing?.warning ? (
                        <span className="badge warn">{o.ageing.days}d</span>
                      ) : (
                        <span className="muted">{o.ageing?.days || 0}d</span>
                      )}
                    </td>
                    <td>
                      {(o.commercialAlerts || []).map((a: any) => (
                        <div key={a.code} className={a.severity === 'red' ? 'error' : 'muted'} style={{ fontSize: 12 }}>
                          {a.message}
                        </div>
                      ))}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn secondary" type="button" onClick={() => openDetail(String(o.id))}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!opps.length && (
                  <tr>
                    <td colSpan={10} className="muted">
                      No opportunities. Create a lead to start.
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
        subtitle="Duplicate/ownership checks run automatically"
        onClose={() => !saving && setModalOpen(false)}
        onSubmit={createOpp}
        submitLabel="Create lead"
        saving={saving}
        error={formError}
        wide
      >
        <label className="field">
          Client{' '}
          <Link href="/sales/clients" style={{ fontWeight: 400, fontSize: 13 }}>
            Manage
          </Link>
          <select
            value={form.clientId}
            onChange={(e) => onClientChange(e.target.value)}
            required
            disabled={saving}
          >
            <option value="">Select</option>
            {clients.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.name)} ({String(c.city)})
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
          Lead source
          <select
            value={form.leadSource}
            onChange={(e) => setForm({ ...form, leadSource: e.target.value })}
            disabled={saving}
          >
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </label>
        <label className="field">
          Probability
          <select
            value={form.probability}
            onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
            disabled={saving}
          >
            {[25, 50, 75, 100].map((p) => (
              <option key={p} value={p}>
                {p}%
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
        {selectedProgram?.programFamily === 'workshop' && (
          <>
            <label className="field">
              Mode
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="offline">Offline</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label className="field">
              Duration (min)
              <select
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              >
                <option value={60}>60</option>
                <option value={90}>90</option>
              </select>
            </label>
            <label className="field">
              Expected students
              <input
                type="number"
                value={form.expectedStudents}
                onChange={(e) => setForm({ ...form, expectedStudents: Number(e.target.value) })}
              />
            </label>
          </>
        )}
        {['iasc', 'nac'].includes(String(selectedProgram?.programFamily)) && (
          <label className="field">
            Expected registrations
            <input
              type="number"
              value={form.expectedRegistrations}
              onChange={(e) => setForm({ ...form, expectedRegistrations: Number(e.target.value) })}
            />
          </label>
        )}
        {selectedProgram?.audience === 'school' && (
          <>
            <label className="field">
              Decision maker
              <select
                value={form.decisionMakerContactId}
                onChange={(e) => setForm({ ...form, decisionMakerContactId: e.target.value })}
              >
                <option value="">Optional at lead</option>
                {contacts.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Coordinator
              <select
                value={form.coordinatorContactId}
                onChange={(e) => setForm({ ...form, coordinatorContactId: e.target.value })}
              >
                <option value="">Optional at lead</option>
                {contacts.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="field">
          Expected close
          <input
            type="date"
            value={form.expectedCloseDate}
            onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
          />
        </label>
        <label className="field">
          Next action
          <input
            value={form.nextAction}
            onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
          />
        </label>
      </FormModal>

      <FormModal
        open={!!detail}
        title={detail ? `${detail.client?.name}` : 'Opportunity'}
        subtitle={detail ? `${detail.program?.name} · Owner ${detail.owner?.fullName}` : ''}
        onClose={() => setDetail(null)}
        onSubmit={async (e) => {
          e.preventDefault();
        }}
        submitLabel="Close"
        saving={false}
        wide
      >
        {detail && (
          <>
            <div className="grid grid-2">
              <div>
                <p>
                  <strong>Stage:</strong> {detail.stage} · <strong>Prob:</strong> {detail.probability}%
                </p>
                <p>
                  <strong>Expected:</strong> ₹{Number(detail.expectedValue || 0).toLocaleString('en-IN')} ·{' '}
                  <strong>Weighted:</strong> ₹{Number(detail.weightedValue || 0).toLocaleString('en-IN')}
                </p>
                <p>
                  <strong>Ageing:</strong> {detail.ageing?.days || 0} days
                  {detail.ageing?.warning ? ' (warning)' : ''}
                  {detail.ageing?.dead ? ' (dead threshold)' : ''}
                </p>
                <p>
                  <strong>Next:</strong> {detail.nextAction || '—'}
                </p>
                {(detail.commercialAlerts || []).map((a: any) => (
                  <div key={a.code} className={a.severity === 'red' ? 'error' : 'muted'}>
                    {a.message}
                  </div>
                ))}
              </div>
              <div>
                {canEdit(detail) && (
                  <>
                    <label className="field">
                      Move stage
                      <select
                        defaultValue={detail.stage}
                        onChange={(e) => {
                          const stage = e.target.value;
                          confirm({
                            title: `Move to ${stage}?`,
                            message: 'Stage changes are recorded in the shared activity feed.',
                            confirmLabel: 'Update',
                            onConfirm: async () => setStage(String(detail.id), stage),
                          });
                        }}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn secondary" type="button" onClick={() => markProposalSent(String(detail.id))}>
                        Mark proposal sent
                      </button>
                      <button className="btn" type="button" onClick={() => setLogOpen(true)}>
                        Log interaction
                      </button>
                    </div>
                  </>
                )}
                {!canEdit(detail) && (
                  <p className="muted">View only — another salesperson owns this opportunity.</p>
                )}
              </div>
            </div>
            <h3>Recent interactions</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Outcome</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.interactions || []).map((i: any) => (
                    <tr key={i.id}>
                      <td>{new Date(i.occurredAt).toLocaleString('en-IN')}</td>
                      <td>{i.interactionType}</td>
                      <td>{i.outcome}{i.isQualifying ? ' · Q' : ''}</td>
                      <td>{i.notes}</td>
                    </tr>
                  ))}
                  {!(detail.interactions || []).length && (
                    <tr>
                      <td colSpan={4} className="muted">
                        No interactions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </FormModal>

      <FormModal
        open={logOpen}
        title="Log interaction"
        subtitle="Unanswered/unreachable calls do not count as completed interactions"
        onClose={() => !saving && setLogOpen(false)}
        onSubmit={submitInteraction}
        submitLabel="Save"
        saving={saving}
        error={formError}
      >
        <label className="field">
          Channel
          <select
            value={interaction.communicationMode}
            onChange={(e) => setInteraction({ ...interaction, communicationMode: e.target.value })}
          >
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="whatsapp_call">WhatsApp Call</option>
            <option value="email">Email</option>
            <option value="zoom">Zoom</option>
            <option value="physical_meeting">In-person</option>
          </select>
        </label>
        <label className="field">
          Type
          <select
            value={interaction.interactionType}
            onChange={(e) => setInteraction({ ...interaction, interactionType: e.target.value })}
          >
            <option value="first_contact">First contact</option>
            <option value="follow_up">Follow-up</option>
            <option value="requirement_discussion">Requirement discussion</option>
            <option value="commercial_discussion">Commercial / price</option>
            <option value="proposal_discussion">Proposal discussion</option>
            <option value="negotiation">Negotiation</option>
            <option value="client_decision">Client decision</option>
            <option value="registration_discussion">Registration / order</option>
          </select>
        </label>
        <label className="field">
          Outcome
          <select
            value={interaction.outcome}
            onChange={(e) => setInteraction({ ...interaction, outcome: e.target.value })}
          >
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
            <option value="connected">Connected</option>
            <option value="callback_requested">Callback requested</option>
            <option value="no_answer">No answer</option>
            <option value="dead_connect">Dead connect</option>
            <option value="cancelled_meeting">Cancelled meeting</option>
          </select>
        </label>
        <label className="field">
          What was discussed
          <textarea
            value={interaction.notes}
            onChange={(e) => setInteraction({ ...interaction, notes: e.target.value })}
            required
          />
        </label>
        <label className="field">
          Next action
          <input
            value={interaction.nextAction}
            onChange={(e) => setInteraction({ ...interaction, nextAction: e.target.value })}
          />
        </label>
        <label className="field">
          Next follow-up
          <input
            type="date"
            value={interaction.nextFollowUpDate}
            onChange={(e) => setInteraction({ ...interaction, nextFollowUpDate: e.target.value })}
          />
        </label>
        <label className="field">
          Move stage (optional)
          <select
            value={interaction.stageAfter}
            onChange={(e) => setInteraction({ ...interaction, stageAfter: e.target.value })}
          >
            <option value="">Keep current</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </FormModal>
    </AppShell>
  );
}
