'use client';

import { AppShell } from '@/components/AppShell';
import { ClientsManager } from '@/components/ClientsManager';

export default function SalesClientsPage() {
  return (
    <AppShell>
      <ClientsManager title="Clients" backHref="/sales" backLabel="Pipeline" />
    </AppShell>
  );
}
