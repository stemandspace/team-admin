import { Router } from 'express';
import { prisma } from '@team-admin/db';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { serverNow } from '../services/common';
import { param } from '../utils/params';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await prisma.notification.findMany({
      where: { recipientPersonId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(rows);
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const row = await prisma.notification.findUnique({ where: { id: param(req, 'id') } });
    if (!row || row.recipientPersonId !== req.user!.id) throw new AppError('Not found', 404);
    res.json(
      await prisma.notification.update({
        where: { id: row.id },
        data: { readAt: serverNow() },
      }),
    );
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { recipientPersonId: req.user!.id, readAt: null },
      data: { readAt: serverNow() },
    });
    res.json({ ok: true });
  }),
);
