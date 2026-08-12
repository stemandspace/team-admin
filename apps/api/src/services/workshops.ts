import {
  prisma,
  ActivityAction,
  DayStatus,
  AllocationStatus,
  WorkshopStatus,
} from '@team-admin/db';
import { PAID_WORKSHOP_CATEGORIES, canApprove } from '@team-admin/shared';
import { AppError } from '../middleware/error';
import type { AuthUser } from '../middleware/auth';
import { toVisibility } from '../middleware/auth';
import {
  getPolicyNumber,
  getPolicyValue,
  logActivity,
  notify,
  parseDateOnly,
  serverNow,
  startOfToday,
  isSameCalendarDay,
} from './common';

// re-export helper — Prisma enum values as strings
const paidSet = new Set(PAID_WORKSHOP_CATEGORIES as readonly string[]);

export async function createWorkshop(
  user: AuthUser,
  input: {
    engagementId?: string | null;
    clientId?: string | null;
    title: string;
    moduleDelivered?: string | null;
    workshopCategory: string;
    revenueType: string;
    mode: string;
    platform?: string;
    locationType?: string | null;
    city: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    sessionsCount?: number;
    sessionStructure?: string;
    batchesPerDay?: number;
    venue?: string | null;
    reportingTime?: string | null;
    deliveryCoordinatorName?: string | null;
    deliveryCoordinatorPhone?: string | null;
    grades?: Array<{
      gradeOrBand: string;
      expectedStudents: number;
      sectionNames?: string | null;
    }>;
  },
) {
  if (!canApprove(toVisibility(user))) throw new AppError('Forbidden', 403);

  const grades = input.grades || [];
  const expectedStudents = grades.reduce((s, g) => s + g.expectedStudents, 0);
  const isPaidWorkshop = paidSet.has(input.workshopCategory);

  const workshop = await prisma.workshop.create({
    data: {
      engagementId: input.engagementId || undefined,
      clientId: input.clientId || undefined,
      title: input.title,
      moduleDelivered: input.moduleDelivered || undefined,
      workshopCategory: input.workshopCategory as never,
      isPaidWorkshop,
      revenueType: input.revenueType as never,
      mode: input.mode as never,
      platform: (input.platform || 'none') as never,
      locationType: (input.locationType || undefined) as never,
      city: input.city,
      scheduledDate: parseDateOnly(input.scheduledDate),
      startTime: input.startTime,
      endTime: input.endTime,
      sessionsCount: input.sessionsCount || 1,
      expectedStudents,
      sessionStructure: (input.sessionStructure || 'sequential') as never,
      batchesPerDay: input.batchesPerDay || 1,
      venue: input.venue || undefined,
      reportingTime: input.reportingTime || undefined,
      deliveryCoordinatorName: input.deliveryCoordinatorName || undefined,
      deliveryCoordinatorPhone: input.deliveryCoordinatorPhone || undefined,
      createdById: user.id,
      status: WorkshopStatus.confirmed,
      grades: {
        create: grades.map((g) => ({
          gradeOrBand: g.gradeOrBand,
          expectedStudents: g.expectedStudents,
          sectionNames: g.sectionNames || undefined,
        })),
      },
    },
    include: { grades: true, client: true, assignments: true },
  });

  await logActivity({
    actor: user,
    action: ActivityAction.insert,
    tableName: 'workshops',
    recordId: workshop.id,
    newValue: { title: workshop.title },
  });

  return workshop;
}

async function creditWeightForRole(role: string) {
  const enabled = (await getPolicyValue('credit_weight_enabled')) === 'true';
  if (!enabled) return 0;
  const key = `credit_weight_${role}`;
  return getPolicyNumber(key, 0);
}

export async function allocateFacilitators(
  user: AuthUser,
  workshopId: string,
  assignments: Array<{
    personId: string;
    assignmentRole: string;
    travelRequired?: boolean;
    travelDateOut?: string | null;
    travelDateReturn?: string | null;
  }>,
  finalize = false,
) {
  if (!canApprove(toVisibility(user))) throw new AppError('Forbidden', 403);

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    include: { grades: true },
  });
  if (!workshop) throw new AppError('Workshop not found', 404);

  if (workshop.sessionStructure === 'parallel') {
    const educators = assignments.filter((a) =>
      a.assignmentRole.includes('educator'),
    ).length;
    if (educators < workshop.batchesPerDay) {
      // warn but allow — returned in response
    }
  }

  const created = [];
  for (const a of assignments) {
    const weight = await creditWeightForRole(a.assignmentRole);
    const row = await prisma.workshopAssignment.upsert({
      where: {
        workshopId_personId_assignmentRole: {
          workshopId,
          personId: a.personId,
          assignmentRole: a.assignmentRole as never,
        },
      },
      update: {
        creditWeight: weight,
        travelRequired: a.travelRequired || false,
        travelDateOut: a.travelDateOut ? parseDateOnly(a.travelDateOut) : null,
        travelDateReturn: a.travelDateReturn
          ? parseDateOnly(a.travelDateReturn)
          : null,
      },
      create: {
        workshopId,
        personId: a.personId,
        assignmentRole: a.assignmentRole as never,
        creditWeight: weight,
        travelRequired: a.travelRequired || false,
        travelDateOut: a.travelDateOut ? parseDateOnly(a.travelDateOut) : null,
        travelDateReturn: a.travelDateReturn
          ? parseDateOnly(a.travelDateReturn)
          : null,
      },
    });
    created.push(row);

    // Write day_record for delivery day
    await prisma.dayRecord.upsert({
      where: {
        personId_date: {
          personId: a.personId,
          date: workshop.scheduledDate,
        },
      },
      update: {
        status: DayStatus.workshop_delivery,
        linkedWorkshopId: workshop.id,
        linkedEngagementId: workshop.engagementId || undefined,
        isLocked: true,
      },
      create: {
        personId: a.personId,
        date: workshop.scheduledDate,
        status: DayStatus.workshop_delivery,
        linkedWorkshopId: workshop.id,
        linkedEngagementId: workshop.engagementId || undefined,
        isLocked: true,
        createdById: user.id,
      },
    });

    // Travel days
    if (a.travelRequired && a.travelDateOut) {
      await prisma.dayRecord.upsert({
        where: {
          personId_date: {
            personId: a.personId,
            date: parseDateOnly(a.travelDateOut),
          },
        },
        update: {
          status: DayStatus.official_travel,
          linkedWorkshopId: workshop.id,
          linkedEngagementId: workshop.engagementId || undefined,
        },
        create: {
          personId: a.personId,
          date: parseDateOnly(a.travelDateOut),
          status: DayStatus.official_travel,
          linkedWorkshopId: workshop.id,
          linkedEngagementId: workshop.engagementId || undefined,
          createdById: user.id,
        },
      });
    }
    if (a.travelRequired && a.travelDateReturn) {
      await prisma.dayRecord.upsert({
        where: {
          personId_date: {
            personId: a.personId,
            date: parseDateOnly(a.travelDateReturn),
          },
        },
        update: {
          status: DayStatus.official_travel,
          linkedWorkshopId: workshop.id,
        },
        create: {
          personId: a.personId,
          date: parseDateOnly(a.travelDateReturn),
          status: DayStatus.official_travel,
          linkedWorkshopId: workshop.id,
          createdById: user.id,
        },
      });

      // Create trip
      await prisma.trip.create({
        data: {
          personId: a.personId,
          engagementId: workshop.engagementId || undefined,
          workshopId: workshop.id,
          city: workshop.city,
          dateOut: parseDateOnly(a.travelDateOut || a.travelDateReturn),
          dateReturn: parseDateOnly(a.travelDateReturn),
          status: 'planned',
        },
      });
    }

    await notify({
      recipientPersonId: a.personId,
      category: 'allocation',
      title: 'Workshop allocated',
      body: `You are allocated to ${workshop.title} on ${workshop.scheduledDate.toISOString().slice(0, 10)}.`,
      linkedRecordType: 'workshop',
      linkedRecordId: workshop.id,
      priority: 'action_required',
    });
  }

  const staffingWarning =
    workshop.sessionStructure === 'parallel' &&
    assignments.filter((a) => a.assignmentRole.includes('educator')).length <
      workshop.batchesPerDay
      ? `Under-staffed for parallel sessions: need ${workshop.batchesPerDay} educators`
      : null;

  const updated = await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      allocationStatus: finalize
        ? AllocationStatus.final
        : AllocationStatus.provisional,
    },
    include: {
      assignments: { include: { person: { select: { id: true, fullName: true, team: true } } } },
      grades: true,
      client: true,
    },
  });

  await logActivity({
    actor: user,
    action: ActivityAction.update,
    tableName: 'workshops',
    recordId: workshopId,
    newValue: { allocationStatus: updated.allocationStatus, count: created.length },
  });

  return { workshop: updated, staffingWarning };
}

export async function submitDeliveryReport(
  user: AuthUser,
  input: {
    workshopId: string;
    actualDate: string;
    teachersEngaged: number;
    sessionsConducted: number;
    batchesConducted: number;
    totalDurationMinutes: number;
    whatWorked?: string | null;
    whatToImprove?: string | null;
    feedbackScore?: number | null;
    gradeActuals: Array<{ gradeBreakdownId: string; actualStudents: number }>;
  },
) {
  const workshop = await prisma.workshop.findUnique({
    where: { id: input.workshopId },
    include: { grades: true, assignments: true },
  });
  if (!workshop) throw new AppError('Workshop not found', 404);

  const assigned = workshop.assignments.some((a) => a.personId === user.id);
  if (!assigned && !canApprove(toVisibility(user))) {
    throw new AppError('Only assigned facilitators can submit', 403);
  }

  const actualDate = parseDateOnly(input.actualDate);
  const today = startOfToday();
  if (!isSameCalendarDay(actualDate, today) && !canApprove(toVisibility(user))) {
    throw new AppError('Delivery reports must be submitted same day; use backdate request');
  }

  // Update grade actuals
  let studentsEngaged = 0;
  for (const g of input.gradeActuals) {
    await prisma.workshopGradeBreakdown.update({
      where: { id: g.gradeBreakdownId },
      data: { actualStudents: g.actualStudents },
    });
    studentsEngaged += g.actualStudents;
  }

  const absenteeismCount = Math.max(0, workshop.expectedStudents - studentsEngaged);
  const variancePct =
    workshop.expectedStudents > 0
      ? Math.abs(studentsEngaged - workshop.expectedStudents) / workshop.expectedStudents
      : 0;
  const varianceFlagged = variancePct > 0.25;

  const report = await prisma.deliveryReport.create({
    data: {
      workshopId: workshop.id,
      engagementId: workshop.engagementId || undefined,
      submittedById: user.id,
      submittedAt: serverNow(),
      actualDate,
      studentsEngaged,
      teachersEngaged: input.teachersEngaged,
      sessionsConducted: input.sessionsConducted,
      batchesConducted: input.batchesConducted,
      totalDurationMinutes: input.totalDurationMinutes,
      absenteeismCount,
      whatWorked: input.whatWorked || undefined,
      whatToImprove: input.whatToImprove || undefined,
      feedbackScore: input.feedbackScore || undefined,
      varianceFlagged,
      isLocked: true,
      wasBackdated: !isSameCalendarDay(actualDate, today),
    },
  });

  await prisma.workshop.update({
    where: { id: workshop.id },
    data: { status: WorkshopStatus.delivered },
  });

  // Comp-off for Sunday delivery
  if (actualDate.getUTCDay() === 0) {
    const days =
      (await getPolicyValue('comp_off_sunday_delivery')) === 'half' ? 0.5 : 1;
    const expiryDays = await getPolicyNumber('comp_off_expiry_days', 90);
    const expiry = new Date(actualDate);
    expiry.setUTCDate(expiry.getUTCDate() + expiryDays);
    await prisma.compOffLedger.create({
      data: {
        personId: user.id,
        earnedDate: actualDate,
        earnedReason: 'sunday_delivery',
        daysEarned: days,
        expiryDate: expiry,
        daysUsed: 0,
        daysRemaining: days,
      },
    });
    await prisma.compensationLedger.create({
      data: {
        personId: user.id,
        kind: 'comp_off',
        sourceDate: actualDate,
        days,
        status: 'available',
        notes: 'Sunday delivery',
      },
    });
  }

  await logActivity({
    actor: user,
    action: ActivityAction.insert,
    tableName: 'delivery_reports',
    recordId: report.id,
    newValue: { studentsEngaged },
  });

  return report;
}

export async function getSchedulingSheet(user: AuthUser, filters?: {
  from?: string;
  to?: string;
  city?: string;
}) {
  // Academic/support see confirmed orders without commercial data
  const where: Record<string, unknown> = {
    status: { in: [WorkshopStatus.confirmed, WorkshopStatus.delivered] },
  };
  if (filters?.from || filters?.to) {
    where.scheduledDate = {};
    if (filters.from) (where.scheduledDate as { gte?: Date }).gte = parseDateOnly(filters.from);
    if (filters.to) (where.scheduledDate as { lte?: Date }).lte = parseDateOnly(filters.to);
  }
  if (filters?.city) where.city = filters.city;

  const workshops = await prisma.workshop.findMany({
    where: where as never,
    include: {
      client: { select: { id: true, name: true, city: true } },
      grades: true,
      assignments: {
        include: {
          person: { select: { id: true, fullName: true, team: true } },
        },
      },
    },
    orderBy: { scheduledDate: 'asc' },
  });

  // Strip commercial: no expected value, no salesperson
  return workshops.map((w) => ({
    id: w.id,
    title: w.title,
    moduleDelivered: w.moduleDelivered,
    clientName: w.client?.name,
    city: w.city,
    scheduledDate: w.scheduledDate,
    startTime: w.startTime,
    endTime: w.endTime,
    mode: w.mode,
    platform: w.platform,
    sessionStructure: w.sessionStructure,
    batchesPerDay: w.batchesPerDay,
    venue: w.venue,
    reportingTime: w.reportingTime,
    deliveryCoordinatorName: w.deliveryCoordinatorName,
    deliveryCoordinatorPhone: w.deliveryCoordinatorPhone,
    grades: w.grades.map((g) => ({
      gradeOrBand: g.gradeOrBand,
      expectedStudents: g.expectedStudents,
      sectionNames: g.sectionNames,
    })),
    expectedStudents: w.expectedStudents,
    team: w.assignments.map((a) => ({
      role: a.assignmentRole,
      name: a.person.fullName,
      travelDateOut: a.travelDateOut,
      travelDateReturn: a.travelDateReturn,
    })),
  }));
}

export async function listAvailableFacilitators(date: string, city?: string) {
  const d = parseDateOnly(date);
  const busy = await prisma.dayRecord.findMany({
    where: {
      date: d,
      status: {
        in: [
          DayStatus.leave_full,
          DayStatus.workshop_delivery,
          DayStatus.official_travel,
          DayStatus.comp_off_taken,
          DayStatus.absent,
        ],
      },
    },
    select: { personId: true },
  });
  const busyIds = new Set(busy.map((b) => b.personId));

  const people = await prisma.person.findMany({
    where: {
      isActive: true,
      team: { in: ['academic', 'support'] },
      ...(city ? { baseCity: city } : {}),
    },
    select: {
      id: true,
      fullName: true,
      team: true,
      baseCity: true,
      employeeCode: true,
    },
  });

  return people
    .filter((p) => !busyIds.has(p.id))
    .map((p) => ({ ...p, available: true }));
}
