'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function ContributionPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api('/analytics/contribution-board').then(setData).catch(console.error);
  }, []);
  const contributors = (data?.contributors as Array<Record<string, unknown>>) || [];
  const totals = data?.teamTotals as { workshops: number; studentsEngaged: number } | undefined;

  return (
    <AppShell>
      <h1>Team Contribution Board</h1>
      <p className="muted">Delivery figures only. Open-platform reach is listed separately and never merged.</p>
      {totals && (
        <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
          <div className="card">
            <div className="muted">Workshops</div>
            <div className="stat">{totals.workshops}</div>
          </div>
          <div className="card">
            <div className="muted">Students engaged</div>
            <div className="stat">{totals.studentsEngaged.toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Team</th>
              <th>Workshops</th>
              <th>Students</th>
              <th>Paid students</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((c) => (
              <tr key={String(c.personId)}>
                <td>{String(c.fullName)}</td>
                <td>{String(c.team)}</td>
                <td>{String(c.workshops)}</td>
                <td>{String(c.students)}</td>
                <td>{String(c.paidStudents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
