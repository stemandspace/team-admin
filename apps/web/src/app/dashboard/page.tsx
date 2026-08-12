'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/lib/loading';

type HomeData = {
  today: {
    serverTime: string;
    record: {
      punchInTime?: string;
      punchOutTime?: string;
      status?: string;
      isLate?: boolean;
    } | null;
    personalAbsenceMinutesMonthly: number;
    freeMinutes: number;
  };
  awaitingMyAction: Record<string, number> | null;
  schedule: { workshops: Array<{ workshop: { title: string; scheduledDate: string; city: string } }> };
  money: { advancesOutstanding: number; compOffDays: number };
  actionRequired: Array<{ type: string; message: string }>;
  unreadNotifications: number;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<HomeData>('/dashboard/home', { loadingLabel: 'Loading dashboard…' })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Today</h1>
          <p className="muted">Welcome back, {user?.fullName}</p>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {loading && <PageLoader label="Loading your day…" />}
      {!loading && data && (
        <div className="grid grid-3">
          <div className="card">
            <h3>Punch status</h3>
            <div className="punch-time">
              {new Date(data.today.serverTime).toLocaleTimeString('en-IN')}
            </div>
            <p className="muted">
              {data.today.record?.punchInTime
                ? `In ${new Date(data.today.record.punchInTime).toLocaleTimeString('en-IN')}`
                : 'Not punched in'}
              {data.today.record?.punchOutTime
                ? ` · Out ${new Date(data.today.record.punchOutTime).toLocaleTimeString('en-IN')}`
                : ''}
            </p>
            {data.today.record?.isLate && <span className="badge warn">Late</span>}
          </div>
          <div className="card">
            <h3>My money</h3>
            <div className="stat">₹{data.money.advancesOutstanding.toLocaleString('en-IN')}</div>
            <p className="muted">Advances outstanding</p>
            <p>
              Comp-off available: <strong>{data.money.compOffDays}</strong> day(s)
            </p>
          </div>
          <div className="card">
            <h3>Action required</h3>
            {data.actionRequired.length === 0 && <p className="muted">Nothing pending</p>}
            <ul>
              {data.actionRequired.map((a, i) => (
                <li key={i}>{a.message}</li>
              ))}
            </ul>
            <p className="muted">{data.unreadNotifications} unread notifications</p>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>Next 14 days</h3>
            {data.schedule.workshops.length === 0 && <p className="muted">No workshops allocated</p>}
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Workshop</th>
                  <th>City</th>
                </tr>
              </thead>
              <tbody>
                {data.schedule.workshops.map((w, i) => (
                  <tr key={i}>
                    <td>{new Date(w.workshop.scheduledDate).toLocaleDateString('en-IN')}</td>
                    <td>{w.workshop.title}</td>
                    <td>{w.workshop.city}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.awaitingMyAction && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3>Awaiting my approval</h3>
              <div className="grid grid-4">
                {Object.entries(data.awaitingMyAction).map(([k, v]) => (
                  <div key={k}>
                    <div className="stat">{v}</div>
                    <div className="muted">{k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
