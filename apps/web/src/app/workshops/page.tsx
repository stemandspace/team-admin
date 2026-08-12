'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function MyWorkshopsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string>('');
  const [grades, setGrades] = useState<Array<{ id: string; gradeOrBand: string; expectedStudents: number; actualStudents?: number }>>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<Array<Record<string, unknown>>>('/workshops?mine=1')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const row = rows.find((r) => String((r.workshop as { id: string }).id) === selected);
    if (!row) return;
    const w = row.workshop as { grades: typeof grades };
    setGrades(w.grades || []);
  }, [selected, rows]);

  async function submitReport(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/workshops/delivery-reports', {
        method: 'POST',
        body: JSON.stringify({
          workshopId: selected,
          actualDate: new Date().toISOString().slice(0, 10),
          teachersEngaged: 1,
          sessionsConducted: 1,
          batchesConducted: 1,
          totalDurationMinutes: 60,
          whatWorked: 'Engagement high',
          whatToImprove: 'Time boxing',
          gradeActuals: grades.map((g) => ({
            gradeBreakdownId: g.id,
            actualStudents: g.actualStudents ?? g.expectedStudents,
          })),
        }),
      });
      setMsg('Delivery report submitted (locked)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  const total = grades.reduce((s, g) => s + (g.actualStudents ?? g.expectedStudents), 0);

  return (
    <AppShell>
      <h1>My Workshops</h1>
      {error && <div className="error">{error}</div>}
      {msg && <p style={{ color: 'var(--ok)' }}>{msg}</p>}
      <div className="grid grid-2">
        <div className="card">
          <h3>Allocations</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const w = r.workshop as { id: string; title: string; scheduledDate: string };
                return (
                  <tr key={String(r.id)}>
                    <td>{new Date(w.scheduledDate).toLocaleDateString('en-IN')}</td>
                    <td>{w.title}</td>
                    <td>
                      <button className="btn secondary" onClick={() => setSelected(w.id)}>
                        Report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {selected && (
          <form className="card" onSubmit={submitReport}>
            <h3>Delivery report</h3>
            <p className="muted">
              Enter grade-wise actuals. Total students engaged is derived (not typed).
            </p>
            {grades.map((g, idx) => (
              <label className="field" key={g.id}>
                {g.gradeOrBand} (expected {g.expectedStudents})
                <input
                  type="number"
                  value={g.actualStudents ?? g.expectedStudents}
                  onChange={(e) => {
                    const next = [...grades];
                    next[idx] = { ...g, actualStudents: Number(e.target.value) };
                    setGrades(next);
                  }}
                />
              </label>
            ))}
            <p>
              Students engaged (sum): <strong>{total}</strong>
            </p>
            <button className="btn" type="submit">
              Submit report
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
