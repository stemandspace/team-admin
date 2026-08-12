'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function AdminAttendancePage() {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 8) + '01');
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      setRows(await api(`/attendance/team?from=${from}&to=${to}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell>
      <h1>Team Attendance</h1>
      {error && <div className="error">{error}</div>}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Date</th>
              <th>Status</th>
              <th>Late</th>
              <th>Hours</th>
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
                  <td>{new Date(String(r.date)).toLocaleDateString('en-IN')}</td>
                  <td>{String(r.status)}</td>
                  <td>{r.isLate ? 'Yes' : '—'}</td>
                  <td>{r.hoursWorked != null ? String(r.hoursWorked) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
