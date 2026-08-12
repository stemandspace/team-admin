'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

const common = [
  { href: '/dashboard', label: 'Home' },
  { href: '/attendance', label: 'My Day' },
  { href: '/leave', label: 'Leave' },
  { href: '/schedule', label: 'Scheduling Sheet' },
  { href: '/workshops', label: 'My Workshops' },
  { href: '/trips', label: 'Trips' },
  { href: '/compensation', label: 'Compensation' },
  { href: '/contribution', label: 'Contribution Board' },
  { href: '/analytics', label: 'My Analytics' },
  { href: '/notifications', label: 'Notifications' },
];

const sales = [
  { href: '/sales', label: 'Pipeline' },
  { href: '/sales/follow-ups', label: 'Follow-ups' },
  { href: '/sales/capacity', label: 'Capacity' },
];

const admin = [
  { href: '/admin/attendance', label: 'Team Attendance' },
  { href: '/admin/approvals', label: 'Approvals' },
  { href: '/admin/workshops', label: 'Workshop Scheduler' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/compliance', label: 'Compliance' },
];

const owner = [
  { href: '/owner', label: 'Org Dashboard' },
  { href: '/owner/activity', label: 'Activity Log' },
  { href: '/owner/payouts', label: 'Payout Register' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="login-page">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  const links = [
    ...common,
    ...(user.team === 'sales' || user.role !== 'employee' ? sales : []),
    ...(user.role === 'administrator' || user.role === 'owner' ? admin : []),
    ...(user.role === 'owner' ? owner : []),
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Workshop Ops
          <span>
            {user.fullName} · {user.role} · {user.team}
          </span>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href || pathname.startsWith(l.href + '/') ? 'active' : ''}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button className="btn secondary" style={{ marginTop: 'auto', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }} onClick={() => logout().then(() => router.push('/login'))}>
          Log out
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
