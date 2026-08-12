'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function ApprovalsPage() {
  const [leave, setLeave] = useState<Array<Record<string, unknown>>>([]);
  const [corrections, setCorrections] = useState<Array<Record<string, unknown>>>([]);
  const [claims, setClaims] = useState<Array<Record<string, unknown>>>([]);

  async function load() {
    setLeave(await api('/leave?scope=all'));
    setCorrections(await api('/compliance/corrections'));
    const trips = await api<Array<Record<string, unknown>>>('/trips');
    const allClaims = trips.flatMap((t) => (t.expenseClaims as Array<Record<string, unknown>>) || []);
    setClaims(allClaims.filter((c) => c.status === 'pending'));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  return (
    <AppShell>
      <h1>Approvals queue</h1>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>Leave</h3>
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
            {leave
              .filter((l) => l.status === 'pending')
              .map((l) => {
                const person = l.person as { fullName: string };
                return (
                  <tr key={String(l.id)}>
                    <td>{person?.fullName}</td>
                    <td>
                      {new Date(String(l.fromDate)).toLocaleDateString('en-IN')} –{' '}
                      {new Date(String(l.toDate)).toLocaleDateString('en-IN')}
                    </td>
                    <td>{String(l.daysCounted)}</td>
                    <td>
                      <button
                        className="btn"
                        onClick={() =>
                          api(`/leave/${l.id}/decide`, {
                            method: 'POST',
                            body: JSON.stringify({ decision: 'approved' }),
                          }).then(load)
                        }
                      >
                        Approve
                      </button>{' '}
                      <button
                        className="btn danger"
                        onClick={() =>
                          api(`/leave/${l.id}/decide`, {
                            method: 'POST',
                            body: JSON.stringify({ decision: 'rejected' }),
                          }).then(load)
                        }
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Correction requests</h3>
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
            {corrections
              .filter((c) => c.status === 'pending')
              .map((c) => {
                const by = c.requestedBy as { fullName: string };
                return (
                  <tr key={String(c.id)}>
                    <td>{by?.fullName}</td>
                    <td>{String(c.fieldName)}</td>
                    <td>{String(c.proposedValue)}</td>
                    <td>
                      <button
                        className="btn"
                        onClick={() =>
                          api(`/compliance/corrections/${c.id}/decide`, {
                            method: 'POST',
                            body: JSON.stringify({ decision: 'approved' }),
                          }).then(load)
                        }
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
