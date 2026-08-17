'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { PageLoader } from '@/lib/loading';

export default function SalesDashboardPage() {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/sales/dashboard', { loadingLabel: 'Loading dashboard…' })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <h1 style={{ margin: 0 }}>Sales Dashboard</h1>
          <Link href="/sales">← Pipeline</Link>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {loading || !data ? (
        <PageLoader label="Loading dashboard…" />
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
            <div className="card">
              <div className="muted">Target (month)</div>
              <div className="stat">₹{Number(data.target || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="card">
              <div className="muted">Achievement</div>
              <div className="stat">₹{Number(data.achievement || 0).toLocaleString('en-IN')}</div>
              <div className="muted">{data.achievementPct != null ? `${data.achievementPct}%` : 'No target'}</div>
            </div>
            <div className="card">
              <div className="muted">Balance</div>
              <div className="stat">₹{Number(data.balance || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="card">
              <div className="muted">Pipeline</div>
              <div className="stat">₹{Number(data.pipeline || 0).toLocaleString('en-IN')}</div>
              <div className="muted">{data.openCount} open</div>
            </div>
            <div className="card">
              <div className="muted">Weighted pipeline</div>
              <div className="stat">₹{Number(data.weightedPipeline || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="card">
              <div className="muted">Projected achievement</div>
              <div className="stat">₹{Number(data.projectedAchievement || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h3>Product mix (open)</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Family</th>
                    <th>Count</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byProduct || []).map((p: any) => (
                    <tr key={p.family}>
                      <td>{p.family}</td>
                      <td>{p.count}</td>
                      <td>₹{Number(p.value).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted">
                School {data.schoolVsRetail?.school || 0} · Retail {data.schoolVsRetail?.retail || 0}
              </p>
            </div>
            <div className="card">
              <h3>Attention</h3>
              <p>
                Follow-ups due/overdue: <strong>{data.followUpsDue}</strong>
              </p>
              <h4>Ageing warnings</h4>
              <ul>
                {(data.ageingWarnings || []).slice(0, 8).map((a: any) => (
                  <li key={a.id}>
                    {a.client} — {a.days}d {a.dead ? '(dead threshold)' : ''}
                  </li>
                ))}
                {!(data.ageingWarnings || []).length && <li className="muted">None</li>}
              </ul>
              <h4>Commercial alerts</h4>
              <ul>
                {(data.commercialAlerts || []).slice(0, 8).map((a: any, i: number) => (
                  <li key={`${a.opportunityId}-${i}`}>
                    {a.client}: {a.message}
                  </li>
                ))}
                {!(data.commercialAlerts || []).length && <li className="muted">None</li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
