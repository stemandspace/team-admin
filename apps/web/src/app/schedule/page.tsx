'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

type SheetRow = {
  id: string;
  title: string;
  clientName?: string;
  city: string;
  scheduledDate: string;
  sessionStructure: string;
  batchesPerDay: number;
  expectedStudents: number;
  venue?: string;
  reportingTime?: string;
  grades: Array<{ gradeOrBand: string; expectedStudents: number }>;
  team: Array<{ role: string; name: string; travelDateOut?: string; travelDateReturn?: string }>;
};

export default function SchedulePage() {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [city, setCity] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const q = city ? `?city=${encodeURIComponent(city)}` : '';
    api<SheetRow[]>(`/workshops/scheduling-sheet${q}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [city]);

  return (
    <AppShell>
      <h1>Scheduling Sheet</h1>
      <p className="muted">
        Confirmed orders only — no commercial values, stages, or salesperson details.
      </p>
      {error && <div className="error">{error}</div>}
      <label className="field" style={{ maxWidth: 280 }}>
        Filter city
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Pune" />
      </label>
      <div className="grid" style={{ marginTop: '1rem' }}>
        {rows.map((r) => (
          <div className="card" key={r.id}>
            <h3>
              {r.clientName || 'Open platform'} — {r.title}
            </h3>
            <p className="muted">
              {new Date(r.scheduledDate).toLocaleDateString('en-IN')} · {r.city} · {r.sessionStructure} ·{' '}
              {r.batchesPerDay} batch(es)
            </p>
            <p>
              Grades:{' '}
              {r.grades.map((g) => `${g.gradeOrBand} (${g.expectedStudents})`).join(', ') || '—'}
            </p>
            <p>Total expected students: {r.expectedStudents}</p>
            <p>
              Team:{' '}
              {r.team.map((t) => `${t.name} (${t.role})`).join(', ') || 'Unallocated'}
            </p>
            {r.venue && <p>Venue: {r.venue} · Report by {r.reportingTime}</p>}
          </div>
        ))}
        {rows.length === 0 && <p className="muted">No confirmed workshops in view.</p>}
      </div>
    </AppShell>
  );
}
