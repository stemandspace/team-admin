'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [holidays, setHolidays] = useState<Array<Record<string, unknown>>>([]);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  async function load() {
    setRules(await api('/policy/rules'));
    setHolidays(await api('/holidays'));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function saveRule() {
    await api(`/policy/rules/${editKey}`, {
      method: 'POST',
      body: JSON.stringify({ ruleValue: editValue }),
    });
    setEditKey('');
    await load();
  }

  async function addHoliday() {
    const date = prompt('Date YYYY-MM-DD');
    const name = prompt('Holiday name');
    if (!date || !name) return;
    await api('/holidays', {
      method: 'POST',
      body: JSON.stringify({ date, name, type: 'gazetted' }),
    });
    await load();
  }

  return (
    <AppShell>
      <h1>Settings</h1>
      <div className="grid grid-2">
        <div className="card">
          <h3>Policy rules</h3>
          <p className="muted">Never hardcode — edit here with effective dating.</p>
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={String(r.id)}>
                  <td>{String(r.ruleKey)}</td>
                  <td>{String(r.ruleValue)}</td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setEditKey(String(r.ruleKey));
                        setEditValue(String(r.ruleValue));
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editKey && (
            <div style={{ marginTop: '1rem' }}>
              <strong>{editKey}</strong>
              <input value={editValue} onChange={(e) => setEditValue(e.target.value)} />
              <button className="btn" onClick={saveRule}>
                Save new version
              </button>
            </div>
          )}
        </div>
        <div className="card">
          <div className="topbar">
            <h3>Holiday calendar</h3>
            <button className="btn secondary" onClick={addHoliday}>
              Add
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={String(h.id)}>
                  <td>{new Date(String(h.date)).toLocaleDateString('en-IN')}</td>
                  <td>{String(h.name)}</td>
                  <td>{String(h.type)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
