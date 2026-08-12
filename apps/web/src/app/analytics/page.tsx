'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api('/analytics/mine').then(setData).catch(console.error);
  }, []);
  if (!data) {
    return (
      <AppShell>
        <p className="muted">Loading…</p>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <h1>My Analytics</h1>
      <div className="grid grid-4">
        <div className="card">
          <div className="muted">Workshops delivered</div>
          <div className="stat">{String(data.workshopsDelivered)}</div>
        </div>
        <div className="card">
          <div className="muted">Students engaged</div>
          <div className="stat">{Number(data.studentsEngaged).toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="muted">Paid students / target</div>
          <div className="stat">
            {String(data.paidStudentsEngaged)}/{String(data.monthlyTarget)}
          </div>
        </div>
        <div className="card">
          <div className="muted">Late days</div>
          <div className="stat">{String(data.lateDays)}</div>
        </div>
      </div>
    </AppShell>
  );
}
