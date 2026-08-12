'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useTransition, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/lib/loading';

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
  const [navigating, startTransition] = useTransition();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    window.dispatchEvent(new Event('app:route-start'));
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event('app:route-end'));
    }, 280);
    return () => window.clearTimeout(t);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="login-page">
        <PageLoader label="Preparing your workspace…" />
      </div>
    );
  }

  const links = [
    ...common,
    ...(user.team === 'sales' || user.role !== 'employee' ? sales : []),
    ...(user.role === 'administrator' || user.role === 'owner' ? admin : []),
    ...(user.role === 'owner' ? owner : []),
  ];

  function go(href: string) {
    if (href === pathname) return;
    window.dispatchEvent(new Event('app:route-start'));
    startTransition(() => {
      router.push(href);
    });
  }

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
            <a
              key={l.href}
              href={l.href}
              className={pathname === l.href || pathname.startsWith(l.href + '/') ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                go(l.href);
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <button
          className="btn secondary"
          style={{ marginTop: 'auto', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
          onClick={() =>
            logout().then(() => {
              router.push('/login');
            })
          }
        >
          Log out
        </button>
      </aside>
      <main className={`main ${navigating ? 'main-navigating' : ''}`}>
        {navigating && (
          <div className="route-veil">
            <div className="loader-ring sm" />
          </div>
        )}
        <div className={navigating ? 'main-content dimmed' : 'main-content'}>{children}</div>
      </main>
    </div>
  );
}
