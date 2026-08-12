'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function ActivityLogPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/compliance/activity-log')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <AppShell>
      <h1>Activity Log</h1>
      <p className="muted">Owner-only. Every action by every user.</p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Table</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const actor = r.actor as { fullName?: string } | null;
              return (
                <tr key={String(r.id)}>
                  <td>{new Date(String(r.occurredAt)).toLocaleString('en-IN')}</td>
                  <td>{actor?.fullName || '—'}</td>
                  <td>{String(r.action)}</td>
                  <td>{String(r.tableName || '—')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
