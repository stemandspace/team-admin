'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function CompliancePage() {
  const [dash, setDash] = useState<Record<string, number> | null>(null);
  const [backdates, setBackdates] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api('/compliance/dashboard').then(setDash).catch(console.error);
    api('/compliance/backdates').then(setBackdates).catch(console.error);
  }, []);

  return (
    <AppShell>
      <h1>Compliance</h1>
      {dash && (
        <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
          {Object.entries(dash).map(([k, v]) => (
            <div className="card" key={k}>
              <div className="muted">{k}</div>
              <div className="stat">{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <h3>Backdate requests</h3>
        <table className="table">
          <thead>
            <tr>
              <th>By</th>
              <th>Target</th>
              <th>Days late</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {backdates.map((b) => {
              const by = b.requestedBy as { fullName: string };
              return (
                <tr key={String(b.id)}>
                  <td>{by?.fullName}</td>
                  <td>{new Date(String(b.targetDate)).toLocaleDateString('en-IN')}</td>
                  <td>{String(b.daysLate)}</td>
                  <td>{String(b.status)}</td>
                  <td>
                    {b.status === 'pending' && (
                      <button
                        className="btn"
                        onClick={() =>
                          api(`/compliance/backdates/${b.id}/decide`, {
                            method: 'POST',
                            body: JSON.stringify({ decision: 'approved' }),
                          }).then(() => api('/compliance/backdates').then(setBackdates))
                        }
                      >
                        Approve
                      </button>
                    )}
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
