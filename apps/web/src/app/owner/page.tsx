'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function OwnerPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api('/dashboard/org').then(setData).catch(console.error);
  }, []);
  return (
    <AppShell>
      <h1>Organisation Dashboard</h1>
      {data && (
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
            <div className="muted">Pipeline expected</div>
            <div className="stat">₹{Number(data.pipelineExpected).toLocaleString('en-IN')}</div>
          </div>
          <div className="card">
            <div className="muted">Revenue collected</div>
            <div className="stat">₹{Number(data.revenueCollected).toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
