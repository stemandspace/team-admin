'use client';

import { AppShell } from '@/components/AppShell';
import { ClientsManager } from '@/components/ClientsManager';

export default function AdminClientsPage() {
  return (
    <AppShell>
      <ClientsManager title="Clients" backHref="/admin/workshops" backLabel="Workshop Scheduler" />
    </AppShell>
  );
}
