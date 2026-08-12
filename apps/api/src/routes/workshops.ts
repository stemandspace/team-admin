import { Router } from 'express';
import { workshopCreateSchema, assignmentSchema, deliveryReportSchema } from '@team-admin/shared';
import { prisma } from '@team-admin/db';
import { z } from 'zod';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireApprover } from '../middleware/auth';
import * as workshops from '../services/workshops';
import { param } from '../utils/params';

export const workshopsRouter = Router();
workshopsRouter.use(requireAuth);

workshopsRouter.get(
  '/scheduling-sheet',
  asyncHandler(async (req, res) => {
    res.json(
      await workshops.getSchedulingSheet(req.user!, {
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        city: req.query.city ? String(req.query.city) : undefined,
      }),
    );
  }),
);

workshopsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const mine = req.query.mine === '1';
    if (mine) {
      const rows = await prisma.workshopAssignment.findMany({
        where: { personId: req.user!.id },
        include: {
          workshop: {
            include: {
              client: { select: { id: true, name: true, city: true } },
              grades: true,
            },
          },
        },
        orderBy: { workshop: { scheduledDate: 'asc' } },
      });
      return res.json(rows);
    }
    if (req.user!.role !== 'administrator' && req.user!.role !== 'owner') {
      throw new AppError('Forbidden', 403);
    }
    const rows = await prisma.workshop.findMany({
      include: {
        client: true,
        grades: true,
        assignments: {
          include: { person: { select: { id: true, fullName: true, team: true } } },
        },
        deliveryReports: true,
      },
      orderBy: { scheduledDate: 'desc' },
    });
    res.json(rows);
  }),
);

workshopsRouter.post(
  '/',
  requireApprover,
  asyncHandler(async (req, res) => {
    const parsed = workshopCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    res.status(201).json(await workshops.createWorkshop(req.user!, parsed.data));
  }),
);

workshopsRouter.post(
  '/:id/allocate',
  requireApprover,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      assignments: z.array(assignmentSchema),
      finalize: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    res.json(
      await workshops.allocateFacilitators(
        req.user!,
        param(req, 'id'),
        parsed.data.assignments,
        parsed.data.finalize,
      ),
    );
  }),
);

workshopsRouter.post(
  '/delivery-reports',
  asyncHandler(async (req, res) => {
    const parsed = deliveryReportSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    res.status(201).json(await workshops.submitDeliveryReport(req.user!, parsed.data));
  }),
);

workshopsRouter.get(
  '/delivery-reports/all',
  requireApprover,
  asyncHandler(async (req, res) => {
    const rows = await prisma.deliveryReport.findMany({
      include: {
        workshop: { include: { client: true } },
        submittedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(rows);
  }),
);

workshopsRouter.post(
  '/delivery-reports/:id/verify',
  requireApprover,
  asyncHandler(async (req, res) => {
    const row = await prisma.deliveryReport.update({
      where: { id: param(req, 'id') },
      data: {
        engagementVerified: true,
        verifiedById: req.user!.id,
        verifiedAt: new Date(),
      },
    });
    res.json(row);
  }),
);
