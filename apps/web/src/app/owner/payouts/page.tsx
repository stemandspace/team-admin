'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function PayoutsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    api('/analytics/payout-register').then(setRows).catch(console.error);
  }, []);
  return (
    <AppShell>
      <h1>Monthly Payout Register</h1>
      <p className="muted">Exportable entitlements — no disbursement (Phase 4).</p>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Kind</th>
              <th>Amount / Days</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const person = r.person as { fullName: string; employeeCode: string };
              return (
                <tr key={String(r.id)}>
                  <td>
                    {person.fullName} ({person.employeeCode})
                  </td>
                  <td>{String(r.kind)}</td>
                  <td>
                    {r.amount != null ? `₹${Number(r.amount).toLocaleString('en-IN')}` : `${r.days} day(s)`}
                  </td>
                  <td>{String(r.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
