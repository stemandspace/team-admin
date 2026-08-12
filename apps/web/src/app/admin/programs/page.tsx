'use client';

import { AppShell } from '@/components/AppShell';
import { ProgramsManager } from '@/components/ProgramsManager';

export default function AdminProgramsPage() {
  return (
    <AppShell>
      <ProgramsManager title="Programs" backHref="/admin/settings" backLabel="Settings" />
    </AppShell>
  );
}
