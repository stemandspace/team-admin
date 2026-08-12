'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function FollowUpsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    api('/sales/follow-ups').then(setRows).catch(console.error);
  }, []);
  return (
    <AppShell>
      <h1>Follow-ups</h1>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Due</th>
              <th>Client</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const opp = r.opportunity as { client: { name: string } };
              return (
                <tr key={String(r.id)}>
                  <td>
                    {r.nextFollowUpDate
                      ? new Date(String(r.nextFollowUpDate)).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                  <td>{opp?.client?.name}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.statusFlag === 'overdue'
                          ? 'danger'
                          : r.statusFlag === 'covered'
                            ? 'warn'
                            : ''
                      }`}
                    >
                      {String(r.statusFlag)}
                    </span>
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
