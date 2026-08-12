'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function TripsPage() {
  const [trips, setTrips] = useState<Array<Record<string, unknown>>>([]);
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api<Array<Record<string, unknown>>>('/trips/mine').then(setTrips).catch(console.error);
    api<Record<string, unknown>>('/trips/settlement/mine').then(setSettlement).catch(console.error);
  }, []);

  return (
    <AppShell>
      <h1>My Trips</h1>
      {settlement && (
        <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
          <div className="card">
            <div className="muted">Advances outstanding</div>
            <div className="stat">₹{Number(settlement.advancesOutstanding).toLocaleString('en-IN')}</div>
          </div>
          <div className="card">
            <div className="muted">Claims approved</div>
            <div className="stat">₹{Number(settlement.claimsApproved).toLocaleString('en-IN')}</div>
          </div>
          <div className="card">
            <div className="muted">Net position</div>
            <div className="stat">₹{Number(settlement.netPosition).toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>City</th>
              <th>Out</th>
              <th>Return</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={String(t.id)}>
                <td>{String(t.city)}</td>
                <td>{new Date(String(t.dateOut)).toLocaleDateString('en-IN')}</td>
                <td>{new Date(String(t.dateReturn)).toLocaleDateString('en-IN')}</td>
                <td>
                  <span className="badge">{String(t.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
