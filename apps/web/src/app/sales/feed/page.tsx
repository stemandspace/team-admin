'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { PageLoader } from '@/lib/loading';

export default function SalesFeedPage() {
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [q, setQ] = useState('');
  const [product, setProduct] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (product) params.set('product', product);
      setRows(await api(`/sales/feed?${params}`, { loadingLabel: 'Loading feed…' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <h1 style={{ margin: 0 }}>Sales Activity Feed</h1>
          <Link href="/sales">← Pipeline</Link>
        </div>
      </div>
      <p className="muted">
        Shared team visibility — see who approached which school/parent, product, stage and next action.
        Viewing does not grant edit rights.
      </p>
      <div className="page-toolbar">
        <div className="toolbar-left">
          <input
            placeholder="Search school / parent / phone / activity"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">All products</option>
            <option value="workshop">Workshop</option>
            <option value="iasc">IASC</option>
            <option value="nac">NAC</option>
            <option value="explorium">Explorium</option>
          </select>
          <button className="btn secondary" type="button" onClick={() => load()}>
            Filter
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <PageLoader label="Loading activity feed…" />
      ) : (
        <div className="card list-panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Salesperson</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Activity</th>
                  <th>Channel</th>
                  <th>Stage</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td>{new Date(String(r.occurredAt)).toLocaleString('en-IN')}</td>
                    <td>{r.person?.fullName}</td>
                    <td>
                      {r.client?.name || '—'}
                      {r.client?.branch ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {r.client.branch}
                        </div>
                      ) : null}
                    </td>
                    <td>{r.program?.name || r.productFamily || '—'}</td>
                    <td>
                      <span className="badge">{r.activityType}</span>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.summary}
                      </div>
                    </td>
                    <td>{r.channel || '—'}</td>
                    <td>{r.stage || r.opportunity?.stage || '—'}</td>
                    <td>{r.nextAction || r.opportunity?.nextAction || '—'}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="muted">
                      No activity yet. Creating leads and logging interactions fills this feed
                      automatically.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
