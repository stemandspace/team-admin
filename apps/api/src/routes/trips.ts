import { Router } from 'express';
import { prisma, ActivityAction } from '@team-admin/db';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireApprover } from '../middleware/auth';
import { logActivity, notify, parseDateOnly, serverNow } from '../services/common';
import { param } from '../utils/params';

export const tripsRouter = Router();
tripsRouter.use(requireAuth);

tripsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const trips = await prisma.trip.findMany({
      where: { personId: req.user!.id },
      include: { advances: true, expenseClaims: true, engagement: true },
      orderBy: { dateOut: 'desc' },
    });
    res.json(trips);
  }),
);

tripsRouter.get(
  '/',
  requireApprover,
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.trip.findMany({
        include: {
          person: { select: { id: true, fullName: true } },
          advances: true,
          expenseClaims: true,
        },
        orderBy: { dateOut: 'desc' },
      }),
    );
  }),
);

tripsRouter.post(
  '/:id/advances',
  requireApprover,
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: param(req, 'id') } });
    if (!trip) throw new AppError('Not found', 404);
    const row = await prisma.advance.create({
      data: {
        tripId: trip.id,
        personId: trip.personId,
        amount: Number(req.body.amount),
        notes: req.body.notes,
      },
    });
    await notify({
      recipientPersonId: trip.personId,
      category: 'advance',
      title: 'Advance issued',
      body: `₹${row.amount} advance for trip to ${trip.city}`,
      linkedRecordId: row.id,
    });
    res.status(201).json(row);
  }),
);

tripsRouter.post(
  '/claims',
  asyncHandler(async (req, res) => {
    const row = await prisma.expenseClaim.create({
      data: {
        tripId: req.body.tripId || undefined,
        personId: req.user!.id,
        claimDate: parseDateOnly(req.body.claimDate),
        category: req.body.category,
        amount: Number(req.body.amount),
        receiptUrl: req.body.receiptUrl,
        notes: req.body.notes,
        status: 'pending',
        isLocked: true,
      },
    });
    res.status(201).json(row);
  }),
);

tripsRouter.post(
  '/claims/:id/decide',
  requireApprover,
  asyncHandler(async (req, res) => {
    const decision = req.body.decision as 'approved' | 'rejected';
    const row = await prisma.expenseClaim.update({
      where: { id: param(req, 'id') },
      data: {
        status: decision,
        approverId: req.user!.id,
        approvedAt: serverNow(),
      },
    });
    await logActivity({
      actor: req.user!,
      action: decision === 'approved' ? ActivityAction.approve : ActivityAction.reject,
      tableName: 'expense_claims',
      recordId: row.id,
    });
    res.json(row);
  }),
);

tripsRouter.get(
  '/settlement/mine',
  asyncHandler(async (req, res) => {
    const advances = await prisma.advance.findMany({
      where: { personId: req.user!.id, settled: false },
    });
    const claims = await prisma.expenseClaim.findMany({
      where: { personId: req.user!.id, status: 'approved' },
    });
    const advanceTotal = advances.reduce((s, a) => s + a.amount, 0);
    const claimTotal = claims.reduce((s, c) => s + c.amount, 0);
    res.json({
      advancesOutstanding: advanceTotal,
      claimsApproved: claimTotal,
      netPosition: claimTotal - advanceTotal,
      advances,
      claims,
    });
  }),
);
