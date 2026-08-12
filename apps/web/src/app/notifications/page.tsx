'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function NotificationsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    setRows(await api('/notifications'));
  }
  useEffect(() => {
    load().catch(console.error);
  }, []);

  return (
    <AppShell>
      <div className="topbar">
        <h1>Notifications</h1>
        <button
          className="btn secondary"
          onClick={() => api('/notifications/read-all', { method: 'POST' }).then(load)}
        >
          Mark all read
        </button>
      </div>
      <div className="grid">
        {rows.map((n) => (
          <div className="card" key={String(n.id)} style={{ opacity: n.readAt ? 0.65 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <strong>{String(n.title)}</strong>
              <span className={`badge ${n.priority === 'urgent' ? 'danger' : n.priority === 'action_required' ? 'warn' : ''}`}>
                {String(n.priority)}
              </span>
            </div>
            <p className="muted">{String(n.body)}</p>
            <small className="muted">{new Date(String(n.createdAt)).toLocaleString('en-IN')}</small>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
