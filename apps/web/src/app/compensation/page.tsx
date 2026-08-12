'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function CompensationPage() {
  const [data, setData] = useState<{
    ledger: Array<Record<string, unknown>>;
    compOff: Array<Record<string, unknown>>;
  } | null>(null);

  useEffect(() => {
    api<typeof data>('/compensation/mine').then(setData).catch(console.error);
  }, []);

  async function elect(id: string, election: 'comp_off' | 'cash') {
    await api('/compensation/elect', {
      method: 'POST',
      body: JSON.stringify({ ledgerId: id, election }),
    });
    setData(await api('/compensation/mine'));
  }

  return (
    <AppShell>
      <h1>My Compensation</h1>
      <p className="muted">Comp-off expiring within 30 days is highlighted.</p>
      <div className="grid grid-2">
        <div className="card">
          <h3>Comp-off balance</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Earned</th>
                <th>Days</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {(data?.compOff || []).map((c) => {
                const daysLeft =
                  (new Date(String(c.expiryDate)).getTime() - Date.now()) / (86400000);
                return (
                  <tr key={String(c.id)}>
                    <td>{new Date(String(c.earnedDate)).toLocaleDateString('en-IN')}</td>
                    <td>{String(c.daysRemaining)}</td>
                    <td>
                      {new Date(String(c.expiryDate)).toLocaleDateString('en-IN')}{' '}
                      {daysLeft <= 30 && <span className="badge warn">Expiring</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Ledger / elections</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Kind</th>
                <th>Election</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.ledger || []).map((l) => (
                <tr key={String(l.id)}>
                  <td>{new Date(String(l.sourceDate)).toLocaleDateString('en-IN')}</td>
                  <td>{String(l.kind)}</td>
                  <td>{String(l.election || '—')}</td>
                  <td>
                    {!l.election && (
                      <>
                        <button className="btn secondary" onClick={() => elect(String(l.id), 'comp_off')}>
                          Comp-off
                        </button>{' '}
                        <button className="btn secondary" onClick={() => elect(String(l.id), 'cash')}>
                          Cash
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
