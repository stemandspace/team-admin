'use client';

import { AppShell } from '@/components/AppShell';
import { ProgramsManager } from '@/components/ProgramsManager';

export default function SalesProgramsPage() {
  return (
    <AppShell>
      <ProgramsManager title="Programs" backHref="/sales" backLabel="Pipeline" />
    </AppShell>
  );
}
