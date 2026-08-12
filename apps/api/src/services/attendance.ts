import {
  prisma,
  DayStatus,
  ActivityAction,
  WorkLocation,
  LeaveType,
  ExtraHoursStatus,
} from '@team-admin/db';
import { AppError } from '../middleware/error';
import type { AuthUser } from '../middleware/auth';
import {
  getPolicyNumber,
  getPolicyValue,
  logActivity,
  notify,
  parseDateOnly,
  parseTimeToMinutes,
  serverNow,
  startOfToday,
  isSameCalendarDay,
} from './common';
import { canSeeAllEmployees } from '@team-admin/shared';
import { toVisibility } from '../middleware/auth';

async function getShiftForPerson(personId: string, team: string) {
  const personShift = await prisma.shiftConfig.findFirst({
    where: { personId },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (personShift) return personShift;
  return prisma.shiftConfig.findFirst({
    where: { team: team as never },
    orderBy: { effectiveFrom: 'desc' },
  });
}

export async function punchIn(
  user: AuthUser,
  input: {
    workLocation: WorkLocation;
    punchInLat?: number | null;
    punchInLng?: number | null;
    lateReason?: string | null;
  },
) {
  const now = serverNow();
  const today = startOfToday();

  let record = await prisma.dayRecord.findUnique({
    where: { personId_date: { personId: user.id, date: today } },
  });

  if (record?.punchInTime) {
    throw new AppError('Already punched in today');
  }
  if (record?.isLocked && record.punchInTime) {
    throw new AppError('Day record is locked');
  }

  const shift = await getShiftForPerson(user.id, user.team);
  const expectedStart = shift?.expectedStartTime || '09:30';
  const grace = shift?.graceMinutes ?? (await getPolicyNumber('grace_minutes', 15));

  let status: DayStatus = DayStatus.present_office;
  if (input.workLocation === 'home') status = DayStatus.present_wfh;
  if (input.workLocation === 'travel') status = DayStatus.official_travel;
  if (record?.status === DayStatus.workshop_delivery || record?.status === DayStatus.official_travel) {
    status = record.status;
  }

  let expectedStartTime = expectedStart;
  let isLate = false;
  let minutesLate = 0;

  const exempt =
    status === DayStatus.workshop_delivery || status === DayStatus.official_travel;

  if (!exempt) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const expectedMinutes = parseTimeToMinutes(expectedStart);
    if (nowMinutes > expectedMinutes + grace) {
      isLate = true;
      minutesLate = nowMinutes - expectedMinutes;
      if (!input.lateReason) {
        throw new AppError('lateReason is mandatory when punching in late');
      }
    }
  } else if (record?.linkedWorkshopId) {
    const workshop = await prisma.workshop.findUnique({
      where: { id: record.linkedWorkshopId },
    });
    if (workshop) expectedStartTime = workshop.startTime;
  }

  if (!record) {
    record = await prisma.dayRecord.create({
      data: {
        personId: user.id,
        date: today,
        status,
        workLocation: input.workLocation,
        punchInTime: now,
        punchInLat: input.punchInLat ?? undefined,
        punchInLng: input.punchInLng ?? undefined,
        expectedStartTime,
        isLate,
        minutesLate,
        lateReason: input.lateReason ?? undefined,
        createdById: user.id,
        submittedAt: now,
        isLocked: false,
      },
    });
  } else {
    record = await prisma.dayRecord.update({
      where: { id: record.id },
      data: {
        status: record.status === DayStatus.workshop_delivery || record.status === DayStatus.official_travel
          ? record.status
          : status,
        workLocation: input.workLocation,
        punchInTime: now,
        punchInLat: input.punchInLat ?? undefined,
        punchInLng: input.punchInLng ?? undefined,
        expectedStartTime,
        isLate,
        minutesLate,
        lateReason: input.lateReason ?? undefined,
        submittedAt: now,
      },
    });
  }

  if (isLate && !exempt) {
    await applyLatenessRules(user, today);
  }

  await logActivity({
    actor: user,
    action: ActivityAction.insert,
    tableName: 'day_record',
    recordId: record.id,
    affectedPersonId: user.id,
    newValue: { punchInTime: now.toISOString(), isLate },
  });

  return record;
}

async function applyLatenessRules(user: AuthUser, today: Date) {
  const consecutiveAlert = await getPolicyNumber('consecutive_late_alert', 3);
  const consecutivePenalty = await getPolicyNumber('consecutive_late_penalty', 4);
  const monthlyThreshold = await getPolicyNumber('monthly_late_threshold', 6);
  const penaltyDays = await getPolicyNumber('late_penalty_days', 0.5);

  const recent = await prisma.dayRecord.findMany({
    where: {
      personId: user.id,
      date: { lte: today },
      isLate: true,
    },
    orderBy: { date: 'desc' },
    take: 20,
  });

  let consecutive = 0;
  for (const r of recent) {
    if (!r.isLate) break;
    consecutive += 1;
  }

  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthlyLates = await prisma.dayRecord.count({
    where: {
      personId: user.id,
      isLate: true,
      date: { gte: monthStart, lte: today },
    },
  });

  if (consecutive === consecutiveAlert) {
    await notify({
      recipientPersonId: user.id,
      category: 'lateness',
      title: 'Lateness alert',
      body: `You have been late ${consecutive} consecutive days.`,
      priority: 'action_required',
    });
    const admins = await prisma.person.findMany({
      where: { role: { in: ['administrator', 'owner'] }, isActive: true },
    });
    for (const a of admins) {
      await notify({
        recipientPersonId: a.id,
        category: 'lateness',
        title: 'Team lateness alert',
        body: `${user.fullName} reached ${consecutive} consecutive late days.`,
        priority: 'action_required',
      });
    }
  }

  const todayRecord = await prisma.dayRecord.findUnique({
    where: { personId_date: { personId: user.id, date: today } },
  });
  if (!todayRecord || todayRecord.penaltyApplied) return;

  let trigger: string | null = null;
  if (consecutive >= consecutivePenalty) trigger = 'consecutive';
  else if (monthlyLates >= monthlyThreshold) trigger = 'monthly';

  if (!trigger) return;

  const source = await deductLeaveHalfDay(user.id, today.getUTCFullYear(), penaltyDays);
  await prisma.dayRecord.update({
    where: { id: todayRecord.id },
    data: {
      penaltyApplied: true,
      penaltyDays,
      penaltyTrigger: trigger,
      penaltySource: source,
    },
  });

  await notify({
    recipientPersonId: user.id,
    category: 'penalty',
    title: 'Late penalty applied',
    body: `Half-day deducted (${source}) due to ${trigger} lateness rule.`,
    priority: 'urgent',
  });
}

async function deductLeaveHalfDay(personId: string, year: number, days: number) {
  const order: LeaveType[] = [LeaveType.casual, LeaveType.earned];
  for (const leaveType of order) {
    const bal = await prisma.leaveBalance.findUnique({
      where: { personId_year_leaveType: { personId, year, leaveType } },
    });
    if (bal && bal.balance >= days) {
      await prisma.leaveBalance.update({
        where: { id: bal.id },
        data: { taken: bal.taken + days, balance: bal.balance - days },
      });
      return leaveType;
    }
  }
  return 'unpaid';
}

export async function punchOut(user: AuthUser) {
  const now = serverNow();
  const today = startOfToday();
  const record = await prisma.dayRecord.findUnique({
    where: { personId_date: { personId: user.id, date: today } },
  });
  if (!record?.punchInTime) throw new AppError('Punch in first');
  if (record.punchOutTime) throw new AppError('Already punched out');

  const hoursWorked =
    (now.getTime() - record.punchInTime.getTime()) / (1000 * 60 * 60);

  const shift = await getShiftForPerson(user.id, user.team);
  const overtimeThreshold =
    (await getPolicyValue('overtime_threshold_time')) || '18:30';
  let extraMinutes: number | null = null;
  let extraHoursStatus: ExtraHoursStatus | null = null;

  const exempt =
    record.status === DayStatus.workshop_delivery ||
    record.status === DayStatus.official_travel;

  if (!exempt) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const threshold = parseTimeToMinutes(overtimeThreshold);
    if (nowMinutes > threshold) {
      extraMinutes = nowMinutes - threshold;
      extraHoursStatus = ExtraHoursStatus.pending;
    }
  }

  const updated = await prisma.dayRecord.update({
    where: { id: record.id },
    data: {
      punchOutTime: now,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      extraMinutes: extraMinutes ?? undefined,
      extraHoursStatus: extraHoursStatus ?? undefined,
      isLocked: true,
      submittedAt: now,
    },
  });

  await logActivity({
    actor: user,
    action: ActivityAction.update,
    tableName: 'day_record',
    recordId: updated.id,
    newValue: { punchOutTime: now.toISOString(), hoursWorked: updated.hoursWorked },
  });

  return updated;
}

export async function getMyAttendance(user: AuthUser, from?: string, to?: string) {
  const where: { personId: string; date?: { gte?: Date; lte?: Date } } = {
    personId: user.id,
  };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = parseDateOnly(from);
    if (to) where.date.lte = parseDateOnly(to);
  }
  return prisma.dayRecord.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 90,
  });
}

export async function getTeamAttendance(user: AuthUser, from: string, to: string) {
  if (!canSeeAllEmployees(toVisibility(user))) {
    throw new AppError('Forbidden', 403);
  }
  return prisma.dayRecord.findMany({
    where: {
      date: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
    },
    include: {
      person: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          team: true,
          role: true,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { person: { fullName: 'asc' } }],
  });
}

export async function getToday(user: AuthUser) {
  const today = startOfToday();
  const record = await prisma.dayRecord.findUnique({
    where: { personId_date: { personId: user.id, date: today } },
    include: { linkedWorkshop: true },
  });
  const openStepOut = await prisma.shortAbsenceRequest.findFirst({
    where: {
      personId: user.id,
      date: today,
      status: { in: ['approved', 'active'] },
    },
    orderBy: { requestedAt: 'desc' },
  });

  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const personalAbsences = await prisma.shortAbsenceRequest.findMany({
    where: {
      personId: user.id,
      category: 'personal',
      status: 'closed',
      date: { gte: monthStart, lte: today },
    },
  });
  const personalMinutes = personalAbsences.reduce(
    (s, a) => s + (a.actualDurationMinutes || 0),
    0,
  );

  return {
    serverTime: serverNow().toISOString(),
    record,
    openStepOut,
    personalAbsenceMinutesMonthly: personalMinutes,
    freeMinutes: await getPolicyNumber('personal_absence_free_minutes_monthly', 120),
  };
}

export { isSameCalendarDay };
