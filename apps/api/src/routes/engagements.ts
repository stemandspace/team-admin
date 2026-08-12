import { Router } from 'express';
import { prisma, ActivityAction } from '@team-admin/db';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireApprover } from '../middleware/auth';
import { logActivity, parseDateOnly } from '../services/common';
import { param } from '../utils/params';

export const engagementsRouter = Router();
engagementsRouter.use(requireAuth);

engagementsRouter.get(
  '/',
  requireApprover,
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.engagement.findMany({
        include: {
          client: true,
          workshops: true,
          opportunities: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }),
);

engagementsRouter.post(
  '/',
  requireApprover,
  asyncHandler(async (req, res) => {
    const row = await prisma.engagement.create({
      data: {
        clientId: req.body.clientId,
        title: req.body.title,
        programId: req.body.programId,
        expectedStudents: req.body.expectedStudents,
        deliveryWindowStart: req.body.deliveryWindowStart
          ? parseDateOnly(req.body.deliveryWindowStart)
          : undefined,
        deliveryWindowEnd: req.body.deliveryWindowEnd
          ? parseDateOnly(req.body.deliveryWindowEnd)
          : undefined,
        expectedValue: req.body.expectedValue,
        totalRevenueCollected: req.body.totalRevenueCollected || 0,
      },
    });
    await logActivity({
      actor: req.user!,
      action: ActivityAction.insert,
      tableName: 'engagements',
      recordId: row.id,
    });
    res.status(201).json(row);
  }),
);

engagementsRouter.patch(
  '/:id/revenue',
  requireApprover,
  asyncHandler(async (req, res) => {
    // Actual revenue lives on engagement only
    const row = await prisma.engagement.update({
      where: { id: param(req, 'id') },
      data: { totalRevenueCollected: Number(req.body.totalRevenueCollected) },
    });
    res.json(row);
  }),
);
