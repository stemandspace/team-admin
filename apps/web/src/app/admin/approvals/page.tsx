'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { PageLoader, useLoading } from '@/lib/loading';

export default function ApprovalsPage() {
  const { confirm } = useLoading();
  const [leave, setLeave] = useState<Array<Record<string, unknown>>>([]);
  const [corrections, setCorrections] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setLeave(await api('/leave?scope=all'));
      setCorrections(await api('/compliance/corrections'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function decideLeave(id: string, decision: 'approved' | 'rejected') {
    setActionId(`${id}:${decision}`);
    setError('');
    try {
      await api(`/leave/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
        loadingLabel: decision === 'approved' ? 'Approving leave…' : 'Rejecting leave…',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  async function deleteLeave(id: string) {
    confirm({
      title: 'Delete leave request?',
      message: 'The employee will be notified. Approved leave will restore balances.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setActionId(`${id}:delete`);
        setError('');
        try {
          await api(`/leave/${id}`, {
            method: 'DELETE',
            loadingLabel: 'Deleting leave…',
          });
          await load();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Delete failed');
          throw e;
        } finally {
          setActionId(null);
        }
      },
    });
  }

  async function decideCorrection(id: string, decision: 'approved' | 'rejected') {
    setActionId(`${id}:${decision}`);
    setError('');
    try {
      await api(`/compliance/corrections/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  const pendingLeave = leave.filter((l) => l.status === 'pending');
  const pendingCorrections = corrections.filter((c) => c.status === 'pending');

  return (
    <AppShell>
      <h1>Approvals queue</h1>
      {error && <div className="error">{error}</div>}

      {loading ? (
        <PageLoader label="Loading approvals…" />
      ) : (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3>Leave</h3>
            {pendingLeave.length === 0 && <p className="muted">No pending leave</p>}
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingLeave.map((l) => {
                  const person = l.person as { fullName: string };
                  const id = String(l.id);
                  const busy = actionId?.startsWith(`${id}:`);
                  return (
                    <tr key={id}>
                      <td>{person?.fullName}</td>
                      <td>
                        {new Date(String(l.fromDate)).toLocaleDateString('en-IN')} –{' '}
                        {new Date(String(l.toDate)).toLocaleDateString('en-IN')}
                      </td>
                      <td>{String(l.daysCounted)}</td>
                      <td>
                        <div className="btn-row">
                          <button
                            className="btn"
                            disabled={!!busy}
                            onClick={() => decideLeave(id, 'approved')}
                          >
                            {actionId === `${id}:approved` ? (
                              <>
                                <span className="spinner light" style={{ marginRight: 6 }} />
                                …
                              </>
                            ) : (
                              'Approve'
                            )}
                          </button>
                          <button
                            className="btn danger"
                            disabled={!!busy}
                            onClick={() => decideLeave(id, 'rejected')}
                          >
                            {actionId === `${id}:rejected` ? (
                              <>
                                <span className="spinner light" style={{ marginRight: 6 }} />
                                …
                              </>
                            ) : (
                              'Reject'
                            )}
                          </button>
                          <button
                            className="btn secondary"
                            disabled={!!busy}
                            onClick={() => deleteLeave(id)}
                          >
                            {actionId === `${id}:delete` ? (
                              <>
                                <span className="spinner" style={{ marginRight: 6 }} />
                                …
                              </>
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Correction requests</h3>
            {pendingCorrections.length === 0 && <p className="muted">No pending corrections</p>}
            <table className="table">
              <thead>
                <tr>
                  <th>By</th>
                  <th>Field</th>
                  <th>Proposed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingCorrections.map((c) => {
                  const by = c.requestedBy as { fullName: string };
                  const id = String(c.id);
                  const busy = actionId?.startsWith(`${id}:`);
                  return (
                    <tr key={id}>
                      <td>{by?.fullName}</td>
                      <td>{String(c.fieldName)}</td>
                      <td>{String(c.proposedValue)}</td>
                      <td>
                        <button
                          className="btn"
                          disabled={!!busy}
                          onClick={() => decideCorrection(id, 'approved')}
                        >
                          {actionId === `${id}:approved` ? (
                            <>
                              <span className="spinner light" style={{ marginRight: 6 }} />
                              …
                            </>
                          ) : (
                            'Approve'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
