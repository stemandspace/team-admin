import { Router } from 'express';
import { prisma } from '@team-admin/db';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireApprover, requireOwner } from '../middleware/auth';
import { getPolicyNumber } from '../services/common';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const personId = req.user!.id;
    const reports = await prisma.deliveryReport.findMany({
      where: { submittedById: personId },
      include: { workshop: true },
    });
    const studentsEngaged = reports.reduce((s, r) => s + r.studentsEngaged, 0);
    const paidStudents = reports
      .filter((r) => r.workshop.isPaidWorkshop)
      .reduce((s, r) => s + r.studentsEngaged, 0);
    const target = await getPolicyNumber('engagement_target_monthly', 400);
    const lateDays = await prisma.dayRecord.count({
      where: { personId, isLate: true },
    });
    const interactions = await prisma.interaction.count({ where: { personId } });
    res.json({
      workshopsDelivered: reports.length,
      studentsEngaged,
      paidStudentsEngaged: paidStudents,
      monthlyTarget: target,
      lateDays,
      interactionsLogged: interactions,
      compOff: await prisma.compOffLedger.findMany({
        where: { personId, daysRemaining: { gt: 0 } },
      }),
    });
  }),
);

analyticsRouter.get(
  '/contribution-board',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const reports = await prisma.deliveryReport.findMany({
      where: { actualDate: { gte: from, lte: to } },
      include: {
        workshop: true,
        submittedBy: { select: { id: true, fullName: true, team: true } },
      },
    });

    const byPerson = new Map<
      string,
      { personId: string; fullName: string; team: string; workshops: number; students: number; paidStudents: number }
    >();
    for (const r of reports) {
      const cur = byPerson.get(r.submittedById) || {
        personId: r.submittedById,
        fullName: r.submittedBy.fullName,
        team: r.submittedBy.team,
        workshops: 0,
        students: 0,
        paidStudents: 0,
      };
      cur.workshops += 1;
      cur.students += r.studentsEngaged;
      if (r.workshop.isPaidWorkshop) cur.paidStudents += r.studentsEngaged;
      byPerson.set(r.submittedById, cur);
    }

    const openReach = await prisma.platformReach.findMany({
      where: { capturedAt: { gte: from, lte: to } },
    });

    res.json({
      period: { from, to },
      contributors: [...byPerson.values()].sort((a, b) => b.students - a.students),
      teamTotals: {
        workshops: reports.length,
        studentsEngaged: reports.reduce((s, r) => s + r.studentsEngaged, 0),
      },
      openReach: {
        note: 'Open-platform reach is separate and never summed into students engaged',
        entries: openReach,
      },
    });
  }),
);

analyticsRouter.get(
  '/payout-register',
  requireOwner,
  asyncHandler(async (req, res) => {
    const month = req.query.month
      ? new Date(String(req.query.month))
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const next = new Date(month);
    next.setMonth(next.getMonth() + 1);
    const rows = await prisma.compensationLedger.findMany({
      where: {
        sourceDate: { gte: month, lt: next },
        OR: [{ election: 'cash' }, { kind: { in: ['incentive', 'travel_allowance', 'extra_hours'] } }],
      },
      include: { person: { select: { fullName: true, employeeCode: true } } },
    });
    res.json(rows);
  }),
);

analyticsRouter.get(
  '/proposal-numbers',
  requireApprover,
  asyncHandler(async (req, res) => {
    const where: Record<string, unknown> = { status: 'delivered' };
    if (req.query.city) where.city = String(req.query.city);
    const workshops = await prisma.workshop.findMany({
      where: where as never,
      include: { deliveryReports: true, client: true },
    });
    if (req.query.board) {
      // filter by client board
    }
    const students = workshops.reduce(
      (s, w) => s + w.deliveryReports.reduce((a, r) => a + r.studentsEngaged, 0),
      0,
    );
    res.json({
      workshops: workshops.length,
      studentsEngaged: students,
      note: 'Open reach excluded — report separately',
    });
  }),
);
