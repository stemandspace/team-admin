import {
  prisma,
  ActivityAction,
  ApprovalStatus,
  DayStatus,
  LeaveType,
  HolidayType,
} from '@team-admin/db';
import { AppError } from '../middleware/error';
import type { AuthUser } from '../middleware/auth';
import { toVisibility } from '../middleware/auth';
import { canApprove, canSeeAllEmployees } from '@team-admin/shared';
import {
  getPolicyValue,
  logActivity,
  notify,
  parseDateOnly,
} from './common';

function eachDate(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    dates.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function computeLeaveDays(
  personId: string,
  fromDate: Date,
  toDate: Date,
  isHalfDay: boolean,
) {
  if (isHalfDay) return 0.5;

  const sandwich = (await getPolicyValue('sandwich_leave_enabled')) === 'true';
  const holidays = await prisma.holidayCalendar.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      type: { in: [HolidayType.gazetted, HolidayType.company, HolidayType.alternate_saturday_off] },
    },
  });
  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

  let counted = 0;
  for (const d of eachDate(fromDate, toDate)) {
    const key = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    if (dow === 0) continue; // Sunday weekly off
    if (holidaySet.has(key)) {
      if (sandwich) counted += 1;
      continue;
    }
    counted += 1;
  }

  // Sandwich: if leave surrounds a holiday/weekend, those days may already be counted when sandwich enabled
  if (sandwich) {
    // Extend: if day before from and day after to are leave-adjacent holidays inside span already handled.
    // Spec: holidays between leave days count — already included above when sandwich true.
  }

  return counted;
}

export async function findWorkshopConflicts(personId: string, from: Date, to: Date) {
  return prisma.workshopAssignment.findFirst({
    where: {
      personId,
      workshop: {
        scheduledDate: { gte: from, lte: to },
        status: { in: ['tentative', 'confirmed'] },
      },
    },
    include: { workshop: true },
  });
}

export async function createLeaveRequest(
  user: AuthUser,
  input: {
    fromDate: string;
    toDate: string;
    leaveType: LeaveType;
    isHalfDay: boolean;
    reason: string;
    substitutePersonId?: string | null;
  },
) {
  const from = parseDateOnly(input.fromDate);
  const to = parseDateOnly(input.toDate);
  if (to < from) throw new AppError('toDate must be on or after fromDate');

  const conflict = await findWorkshopConflicts(user.id, from, to);
  if (conflict && !input.substitutePersonId) {
    throw new AppError(
      `Conflict with workshop "${conflict.workshop.title}" on ${conflict.workshop.scheduledDate.toISOString().slice(0, 10)}. Provide substitutePersonId.`,
    );
  }

  const daysCounted = await computeLeaveDays(user.id, from, to, input.isHalfDay);

  const year = from.getUTCFullYear();
  if (input.leaveType !== LeaveType.unpaid) {
    const bal = await prisma.leaveBalance.findUnique({
      where: {
        personId_year_leaveType: {
          personId: user.id,
          year,
          leaveType: input.leaveType,
        },
      },
    });
    if (!bal || bal.balance < daysCounted) {
      throw new AppError('Insufficient leave balance');
    }
  }

  const req = await prisma.leaveRequest.create({
    data: {
      personId: user.id,
      fromDate: from,
      toDate: to,
      leaveType: input.leaveType,
      isHalfDay: input.isHalfDay,
      reason: input.reason,
      daysCounted,
      status: ApprovalStatus.pending,
      conflictingWorkshopId: conflict?.workshopId,
      substitutePersonId: input.substitutePersonId || undefined,
    },
  });

  const approvers = await prisma.person.findMany({
    where: {
      OR: [
        { id: (await prisma.person.findUnique({ where: { id: user.id } }))?.reportsToId || 'none' },
        { role: { in: ['administrator', 'owner'] }, isActive: true },
      ],
    },
  });
  for (const a of approvers) {
    if (a.id === user.id) continue;
    await notify({
      recipientPersonId: a.id,
      category: 'leave',
      title: 'Leave approval needed',
      body: `${user.fullName} requested ${daysCounted} day(s) leave.`,
      linkedRecordType: 'leave_request',
      linkedRecordId: req.id,
      priority: 'action_required',
    });
  }

  await logActivity({
    actor: user,
    action: ActivityAction.insert,
    tableName: 'leave_request',
    recordId: req.id,
    newValue: req,
  });

  return req;
}

export async function decideLeave(
  approver: AuthUser,
  id: string,
  decision: 'approved' | 'rejected',
  comment?: string,
) {
  if (!canApprove(toVisibility(approver))) throw new AppError('Forbidden', 403);

  const req = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!req) throw new AppError('Not found', 404);
  if (req.status !== ApprovalStatus.pending) throw new AppError('Already decided');

  if (decision === 'rejected') {
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.rejected,
        approverId: approver.id,
        approverComment: comment,
      },
    });
    await notify({
      recipientPersonId: req.personId,
      category: 'leave',
      title: 'Leave rejected',
      body: comment || 'Your leave request was rejected.',
      linkedRecordId: id,
      priority: 'action_required',
    });
    await logActivity({
      actor: approver,
      action: ActivityAction.reject,
      tableName: 'leave_request',
      recordId: id,
      reason: comment,
    });
    return updated;
  }

  // approved
  const days = req.daysCounted || 0;
  if (req.leaveType !== LeaveType.unpaid) {
    const bal = await prisma.leaveBalance.findUnique({
      where: {
        personId_year_leaveType: {
          personId: req.personId,
          year: req.fromDate.getUTCFullYear(),
          leaveType: req.leaveType,
        },
      },
    });
    if (!bal || bal.balance < days) throw new AppError('Insufficient balance at approval time');
    await prisma.leaveBalance.update({
      where: { id: bal.id },
      data: { taken: bal.taken + days, balance: bal.balance - days },
    });
  }

  for (const d of eachDate(req.fromDate, req.toDate)) {
    const dow = d.getUTCDay();
    if (dow === 0) continue;
    await prisma.dayRecord.upsert({
      where: { personId_date: { personId: req.personId, date: d } },
      update: {
        status: req.isHalfDay ? DayStatus.leave_half : DayStatus.leave_full,
        leaveType: req.leaveType,
        isPaid: req.leaveType !== LeaveType.unpaid,
        isLocked: true,
        approvedById: approver.id,
        approvalStatus: ApprovalStatus.approved,
      },
      create: {
        personId: req.personId,
        date: d,
        status: req.isHalfDay ? DayStatus.leave_half : DayStatus.leave_full,
        leaveType: req.leaveType,
        isPaid: req.leaveType !== LeaveType.unpaid,
        isLocked: true,
        approvedById: approver.id,
        approvalStatus: ApprovalStatus.approved,
        createdById: approver.id,
      },
    });
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.approved,
      approverId: approver.id,
      approverComment: comment,
    },
  });

  await notify({
    recipientPersonId: req.personId,
    category: 'leave',
    title: 'Leave approved',
    body: `Your leave (${days} day(s)) was approved.`,
    linkedRecordId: id,
    priority: 'info',
  });

  await logActivity({
    actor: approver,
    action: ActivityAction.approve,
    tableName: 'leave_request',
    recordId: id,
  });

  return updated;
}

export async function listLeave(user: AuthUser, scope: 'mine' | 'all' = 'mine') {
  if (scope === 'all') {
    if (!canSeeAllEmployees(toVisibility(user))) throw new AppError('Forbidden', 403);
    return prisma.leaveRequest.findMany({
      include: {
        person: { select: { id: true, fullName: true, employeeCode: true, team: true } },
        conflictingWorkshop: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  return prisma.leaveRequest.findMany({
    where: { personId: user.id },
    include: { conflictingWorkshop: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getBalances(user: AuthUser, personId?: string) {
  const id = personId || user.id;
  if (id !== user.id && !canSeeAllEmployees(toVisibility(user))) {
    throw new AppError('Forbidden', 403);
  }
  const year = new Date().getFullYear();
  return prisma.leaveBalance.findMany({ where: { personId: id, year } });
}
