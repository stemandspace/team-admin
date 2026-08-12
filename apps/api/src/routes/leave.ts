import { Router } from 'express';
import { leaveRequestSchema } from '@team-admin/shared';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireApprover } from '../middleware/auth';
import * as leave from '../services/leave';
import { parseDateOnly } from '../services/common';
import { param } from '../utils/params';

export const leaveRouter = Router();
leaveRouter.use(requireAuth);

leaveRouter.get(
  '/balances',
  asyncHandler(async (req, res) => {
    res.json(await leave.getBalances(req.user!, req.query.personId ? String(req.query.personId) : undefined));
  }),
);

leaveRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = req.query.scope === 'all' ? 'all' : 'mine';
    res.json(await leave.listLeave(req.user!, scope));
  }),
);

leaveRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = leaveRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    const preview = await leave.computeLeaveDays(
      req.user!.id,
      parseDateOnly(parsed.data.fromDate),
      parseDateOnly(parsed.data.toDate),
      parsed.data.isHalfDay,
    );
    const conflict = await leave.findWorkshopConflicts(
      req.user!.id,
      parseDateOnly(parsed.data.fromDate),
      parseDateOnly(parsed.data.toDate),
    );
    if (req.query.preview === '1') {
      return res.json({ daysCounted: preview, conflict });
    }
    const row = await leave.createLeaveRequest(req.user!, {
      ...parsed.data,
      leaveType: parsed.data.leaveType as never,
    });
    res.status(201).json(row);
  }),
);

leaveRouter.get(
  '/preview',
  asyncHandler(async (req, res) => {
    const from = String(req.query.fromDate || '');
    const to = String(req.query.toDate || '');
    const isHalfDay = req.query.isHalfDay === 'true';
    if (!from || !to) throw new AppError('fromDate and toDate required');
    const daysCounted = await leave.computeLeaveDays(
      req.user!.id,
      parseDateOnly(from),
      parseDateOnly(to),
      isHalfDay,
    );
    const conflict = await leave.findWorkshopConflicts(
      req.user!.id,
      parseDateOnly(from),
      parseDateOnly(to),
    );
    res.json({ daysCounted, conflict });
  }),
);

leaveRouter.post(
  '/:id/decide',
  requireApprover,
  asyncHandler(async (req, res) => {
    const decision = req.body.decision as 'approved' | 'rejected';
    if (decision !== 'approved' && decision !== 'rejected') {
      throw new AppError('decision must be approved or rejected');
    }
    res.json(await leave.decideLeave(req.user!, param(req, 'id'), decision, req.body.comment));
  }),
);

leaveRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await leave.deleteLeaveRequest(req.user!, param(req, 'id')));
  }),
);
