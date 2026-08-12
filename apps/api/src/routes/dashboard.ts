import { Router } from 'express';
import { prisma } from '@team-admin/db';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireApprover, requireOwner } from '../middleware/auth';
import { getToday } from '../services/attendance';
import { startOfToday } from '../services/common';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/home',
  asyncHandler(async (req, res) => {
    const today = await getToday(req.user!);
    const pendingMine = await prisma.leaveRequest.findMany({
      where: { personId: req.user!.id, status: 'pending' },
    });
    const awaitingMyAction =
      req.user!.role === 'administrator' || req.user!.role === 'owner'
        ? {
            leave: await prisma.leaveRequest.count({ where: { status: 'pending' } }),
            corrections: await prisma.correctionRequest.count({
              where: { status: 'pending' },
            }),
            backdates: await prisma.backdateRequest.count({
              where: { status: 'pending' },
            }),
            claims: await prisma.expenseClaim.count({ where: { status: 'pending' } }),
          }
        : null;

    const from = startOfToday();
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 14);

    const schedule = await prisma.workshopAssignment.findMany({
      where: {
        personId: req.user!.id,
        workshop: { scheduledDate: { gte: from, lte: to } },
      },
      include: {
        workshop: {
          select: {
            id: true,
            title: true,
            scheduledDate: true,
            city: true,
            startTime: true,
            venue: true,
          },
        },
      },
    });

    const leaveApproved = await prisma.leaveRequest.findMany({
      where: {
        personId: req.user!.id,
        status: 'approved',
        fromDate: { lte: to },
        toDate: { gte: from },
      },
    });

    const advances = await prisma.advance.aggregate({
      where: { personId: req.user!.id, settled: false },
      _sum: { amount: true },
    });
    const compOff = await prisma.compOffLedger.aggregate({
      where: { personId: req.user!.id, daysRemaining: { gt: 0 } },
      _sum: { daysRemaining: true },
    });

    const unread = await prisma.notification.count({
      where: { recipientPersonId: req.user!.id, readAt: null },
    });

    const actionRequired = [];
    if (today.record?.punchInTime && !today.record.punchOutTime) {
      actionRequired.push({ type: 'missing_punch_out', message: 'Punch out still open' });
    }
    const unsubmitted = await prisma.workshopAssignment.findMany({
      where: {
        personId: req.user!.id,
        workshop: {
          scheduledDate: { lt: startOfToday() },
          status: 'confirmed',
          deliveryReports: { none: {} },
        },
      },
      include: { workshop: { select: { title: true, scheduledDate: true } } },
    });
    for (const u of unsubmitted) {
      actionRequired.push({
        type: 'missing_delivery_report',
        message: `Report due: ${u.workshop.title}`,
        workshopId: u.workshopId,
      });
    }

    const expiringComp = await prisma.compOffLedger.findMany({
      where: {
        personId: req.user!.id,
        daysRemaining: { gt: 0 },
        expiryDate: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    });
    for (const c of expiringComp) {
      actionRequired.push({
        type: 'comp_off_expiring',
        message: `${c.daysRemaining} day(s) expire ${c.expiryDate.toISOString().slice(0, 10)}`,
      });
    }

    res.json({
      today,
      myPending: pendingMine,
      awaitingMyAction,
      schedule: {
        workshops: schedule,
        leave: leaveApproved,
      },
      money: {
        advancesOutstanding: advances._sum.amount || 0,
        compOffDays: compOff._sum.daysRemaining || 0,
      },
      unreadNotifications: unread,
      actionRequired,
      team: req.user!.team,
      role: req.user!.role,
    });
  }),
);

dashboardRouter.get(
  '/org',
  requireOwner,
  asyncHandler(async (_req, res) => {
    const workshopsDelivered = await prisma.workshop.count({
      where: { status: 'delivered' },
    });
    const students = await prisma.deliveryReport.aggregate({
      _sum: { studentsEngaged: true },
    });
    const byCity = await prisma.workshop.groupBy({
      by: ['city'],
      where: { status: 'delivered' },
      _count: true,
    });
    const pipeline = await prisma.opportunity.aggregate({
      where: { stage: { notIn: ['lost', 'not_interested', 'completed'] } },
      _sum: { expectedValue: true },
    });
    const collected = await prisma.engagement.aggregate({
      _sum: { totalRevenueCollected: true },
    });
    res.json({
      workshopsDelivered,
      studentsEngaged: students._sum.studentsEngaged || 0,
      byCity,
      pipelineExpected: pipeline._sum.expectedValue || 0,
      revenueCollected: collected._sum.totalRevenueCollected || 0,
    });
  }),
);

dashboardRouter.get(
  '/admin',
  requireApprover,
  asyncHandler(async (_req, res) => {
    res.json({
      pendingLeave: await prisma.leaveRequest.count({ where: { status: 'pending' } }),
      pendingClaims: await prisma.expenseClaim.count({ where: { status: 'pending' } }),
      unallocated: await prisma.workshop.count({
        where: {
          status: 'confirmed',
          allocationStatus: 'unallocated',
        },
      }),
      varianceReports: await prisma.deliveryReport.count({
        where: { varianceFlagged: true, engagementVerified: false },
      }),
    });
  }),
);
