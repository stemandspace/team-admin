'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function CapacityPage() {
  const [city, setCity] = useState('Pune');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const q = new URLSearchParams({ city, from, to });
      setRows(await api(`/sales/capacity?${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <AppShell>
      <h1>Capacity view</h1>
      <p className="muted">Slot counts only — no names or leave reasons.</p>
      {error && <div className="error">{error}</div>}
      <div className="card" style={{ display: 'grid', gap: '0.75rem', maxWidth: 480 }}>
        <label className="field">
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label className="field">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn" onClick={load}>
          Check capacity
        </button>
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Available</th>
              <th>Tentative</th>
              <th>Firm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.date)}>
                <td>{String(r.date)}</td>
                <td>{String(r.availableSlots)} / {String(r.totalEducators)}</td>
                <td>{String(r.tentativeHolds)}</td>
                <td>{String(r.firmBookings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
