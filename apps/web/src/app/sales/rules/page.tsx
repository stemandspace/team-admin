'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { PageLoader } from '@/lib/loading';

export default function SalesRulesPage() {
  const [data, setData] = useState<{ rules: Array<{ id: string; title: string; body: string }>; defaults: Record<string, unknown> } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/sales/rules', { silent: true })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="page-toolbar" style={{ marginTop: 0 }}>
        <div className="toolbar-left">
          <h1 style={{ margin: 0 }}>Rules & Governance</h1>
          <Link href="/sales">← Pipeline</Link>
        </div>
      </div>
      <p className="muted">
        When the CRM blocks an action or applies a rule, the governing principle is explained here.
      </p>
      {error && <div className="error">{error}</div>}
      {loading || !data ? (
        <PageLoader label="Loading rules…" />
      ) : (
        <div className="grid grid-2">
          <div className="card list-panel">
            {data.rules.map((r) => (
              <div key={r.id} style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ marginBottom: 4 }}>{r.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {r.body}
                </p>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Current configurable values</h3>
            <table className="table">
              <tbody>
                {Object.entries(data.defaults).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
