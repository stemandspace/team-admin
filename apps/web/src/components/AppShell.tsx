'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/lib/loading';

type NavItem = { href: string; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/sales') return pathname === '/sales';
  if (href === '/owner') return pathname === '/owner';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupContainsPath(group: NavGroup, pathname: string) {
  return group.items.some((item) => isActive(pathname, item.href));
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navigating, startTransition] = useTransition();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo<NavGroup[]>(() => {
    if (!user) return [];

    const list: NavGroup[] = [
      {
        id: 'home',
        label: 'Home',
        items: [
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/notifications', label: 'Notifications' },
        ],
      },
      {
        id: 'my-work',
        label: 'My Work',
        items: [
          { href: '/attendance', label: 'My Day' },
          { href: '/leave', label: 'Leave' },
          { href: '/workshops', label: 'My Workshops' },
          { href: '/trips', label: 'Trips' },
          { href: '/compensation', label: 'Compensation' },
        ],
      },
      {
        id: 'team',
        label: 'Team & Insights',
        items: [
          { href: '/schedule', label: 'Scheduling Sheet' },
          { href: '/contribution', label: 'Contribution Board' },
          { href: '/analytics', label: 'My Analytics' },
        ],
      },
    ];

    if (user.team === 'sales' || user.role !== 'employee') {
      list.push({
        id: 'sales',
        label: 'Sales',
        items: [
          { href: '/sales', label: 'Pipeline' },
          { href: '/sales/clients', label: 'Clients' },
          { href: '/sales/programs', label: 'Programs' },
          { href: '/sales/follow-ups', label: 'Follow-ups' },
          { href: '/sales/capacity', label: 'Capacity' },
        ],
      });
    }

    if (user.role === 'administrator' || user.role === 'owner') {
      list.push({
        id: 'admin',
        label: 'Administration',
        items: [
          { href: '/admin/attendance', label: 'Team Attendance' },
          { href: '/admin/approvals', label: 'Approvals' },
          { href: '/admin/workshops', label: 'Workshop Scheduler' },
          { href: '/admin/clients', label: 'Clients' },
          { href: '/admin/programs', label: 'Programs' },
          { href: '/admin/people', label: 'People' },
          { href: '/admin/settings', label: 'Settings' },
          { href: '/admin/compliance', label: 'Compliance' },
        ],
      });
    }

    if (user.role === 'owner') {
      list.push({
        id: 'owner',
        label: 'Owner',
        items: [
          { href: '/owner', label: 'Org Dashboard' },
          { href: '/owner/activity', label: 'Activity Log' },
          { href: '/owner/payouts', label: 'Payout Register' },
        ],
      });
    }

    return list;
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    window.dispatchEvent(new Event('app:route-start'));
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event('app:route-end'));
    }, 280);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const active = groups.find((group) => groupContainsPath(group, pathname));
    if (!active) return;
    setOpenGroups({ [active.id]: true });
  }, [pathname, groups]);

  if (loading || !user) {
    return (
      <div className="login-page">
        <PageLoader label="Preparing your workspace…" />
      </div>
    );
  }

  function go(href: string) {
    if (href === pathname) return;
    window.dispatchEvent(new Event('app:route-start'));
    startTransition(() => {
      router.push(href);
    });
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const isOpen = !!prev[id];
      return isOpen ? {} : { [id]: true };
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Team Admin
          <span>
            {user.fullName} · {user.role} · {user.team}
          </span>
        </div>
        <nav className="nav">
          {groups.map((group) => {
            const open = openGroups[group.id] ?? groupContainsPath(group, pathname);
            const activeGroup = groupContainsPath(group, pathname);
            return (
              <div key={group.id} className={`nav-group ${open ? 'open' : ''} ${activeGroup ? 'has-active' : ''}`}>
                <button
                  type="button"
                  className="nav-group-toggle"
                  aria-expanded={open}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span>{group.label}</span>
                  <span className="nav-chevron" aria-hidden>
                    ▾
                  </span>
                </button>
                {open && (
                  <div className="nav-group-items">
                    {group.items.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        className={isActive(pathname, item.href) ? 'active' : ''}
                        onClick={(e) => {
                          e.preventDefault();
                          go(item.href);
                        }}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
