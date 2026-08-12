import { Router } from 'express';
import { prisma } from '@team-admin/db';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { getPolicyNumber, serverNow } from '../services/common';

export const compensationRouter = Router();
compensationRouter.use(requireAuth);

compensationRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const ledger = await prisma.compensationLedger.findMany({
      where: { personId: req.user!.id },
      orderBy: { sourceDate: 'desc' },
    });
    const compOff = await prisma.compOffLedger.findMany({
      where: { personId: req.user!.id },
      orderBy: { expiryDate: 'asc' },
    });
    const divisor = await getPolicyNumber('days_divisor', 26);
    // cash value shown only if salary exists (owner sets it) — employees see days; amount if election cash pending
    res.json({ ledger, compOff, daysDivisor: divisor, serverTime: serverNow() });
  }),
);

compensationRouter.post(
  '/elect',
  asyncHandler(async (req, res) => {
    const id = req.body.ledgerId as string;
    const election = req.body.election as 'comp_off' | 'cash';
    const row = await prisma.compensationLedger.findUnique({ where: { id } });
    if (!row || row.personId !== req.user!.id) throw new AppError('Not found', 404);
    if (row.election) throw new AppError('Already elected');
    const updated = await prisma.compensationLedger.update({
      where: { id },
      data: { election, status: 'elected' },
    });
    res.json(updated);
  }),
);
