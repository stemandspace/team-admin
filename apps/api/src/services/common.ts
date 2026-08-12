import { prisma, ActivityAction, Role } from '@team-admin/db';
import type { AuthUser } from '../middleware/auth';

export async function logActivity(params: {
  actor?: AuthUser | null;
  action: ActivityAction;
  tableName?: string;
  recordId?: string;
  affectedPersonId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string;
  linkedCorrectionId?: string;
  linkedBackdateId?: string;
}) {
  await prisma.activityLog.create({
    data: {
      actorPersonId: params.actor?.id,
      actorRoleAtTime: params.actor?.role as Role | undefined,
      action: params.action,
      tableName: params.tableName,
      recordId: params.recordId,
      affectedPersonId: params.affectedPersonId,
      oldValue: params.oldValue as object | undefined,
      newValue: params.newValue as object | undefined,
      reason: params.reason,
      ipAddress: params.ipAddress,
      linkedCorrectionId: params.linkedCorrectionId,
      linkedBackdateId: params.linkedBackdateId,
    },
  });
}

export async function notify(params: {
  recipientPersonId: string;
  category: string;
  title: string;
  body: string;
  linkedRecordType?: string;
  linkedRecordId?: string;
  deepLink?: string;
  priority?: 'info' | 'action_required' | 'urgent';
}) {
  return prisma.notification.create({
    data: {
      recipientPersonId: params.recipientPersonId,
      category: params.category,
      title: params.title,
      body: params.body,
      linkedRecordType: params.linkedRecordType,
      linkedRecordId: params.linkedRecordId,
      deepLink: params.deepLink,
      priority: params.priority || 'info',
    },
  });
}

export async function getPolicyValue(ruleKey: string, onDate = new Date()): Promise<string | null> {
  const rule = await prisma.policyRule.findFirst({
    where: {
      ruleKey,
      effectiveFrom: { lte: onDate },
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return rule?.ruleValue ?? null;
}

export async function getPolicyNumber(ruleKey: string, fallback: number, onDate = new Date()) {
  const v = await getPolicyValue(ruleKey, onDate);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function serverNow() {
  return new Date();
}

export function startOfToday() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function parseDateOnly(iso: string) {
  const [y, m, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function parseTimeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
