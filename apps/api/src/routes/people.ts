import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, ActivityAction, LeaveType } from '@team-admin/db';
import { createPersonSchema } from '@team-admin/shared';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { logActivity } from '../services/common';
import { param } from '../utils/params';

export const peopleRouter = Router();

peopleRouter.use(requireAuth);

peopleRouter.get(
  '/',
  requireRole('administrator', 'owner'),
  asyncHandler(async (_req, res) => {
    const people = await prisma.person.findMany({
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        email: true,
        phone: true,
        team: true,
        role: true,
        baseCity: true,
        dateOfJoining: true,
        isActive: true,
        reportsToId: true,
      },
      orderBy: { fullName: 'asc' },
    });
    res.json(people);
  }),
);

peopleRouter.get(
  '/facilitators',
  requireRole('administrator', 'owner'),
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || '');
    const city = req.query.city ? String(req.query.city) : undefined;
    if (!date) throw new AppError('date required');
    const { listAvailableFacilitators } = await import('../services/workshops');
    res.json(await listAvailableFacilitators(date, city));
  }),
);

peopleRouter.post(
  '/',
  requireRole('administrator', 'owner'),
  asyncHandler(async (req, res) => {
    const parsed = createPersonSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    if (parsed.data.role === 'owner' && req.user!.role !== 'owner') {
      throw new AppError('Only owner can create owners', 403);
    }

    const hash = await bcrypt.hash(parsed.data.password, 10);
    const person = await prisma.person.create({
      data: {
        fullName: parsed.data.fullName,
        employeeCode: parsed.data.employeeCode,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone,
        passwordHash: hash,
        team: parsed.data.team,
        role: parsed.data.role,
        baseCity: parsed.data.baseCity,
        reportsToId: parsed.data.reportsToId || undefined,
        dateOfJoining: new Date(parsed.data.dateOfJoining),
      },
    });

    const year = new Date().getFullYear();
    for (const leaveType of [LeaveType.casual, LeaveType.sick, LeaveType.earned]) {
      const annual = leaveType === LeaveType.casual || leaveType === LeaveType.sick ? 12 : 15;
      await prisma.leaveBalance.create({
        data: {
          personId: person.id,
          year,
          leaveType,
          openingBalance: annual,
          accrued: annual,
          taken: 0,
          balance: annual,
        },
      });
    }

    await logActivity({
      actor: req.user!,
      action: ActivityAction.insert,
      tableName: 'people',
      recordId: person.id,
      newValue: { email: person.email, role: person.role },
    });

    const { passwordHash: _, ...safe } = person;
    res.status(201).json(safe);
  }),
);

peopleRouter.patch(
  '/:id/deactivate',
  requireRole('administrator', 'owner'),
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const person = await prisma.person.findUnique({ where: { id } });
    if (!person) throw new AppError('Not found', 404);
    if (person.role === 'owner') throw new AppError('Cannot deactivate owner');

    const updated = await prisma.person.update({
      where: { id },
      data: { isActive: false },
    });

    const openOpps = await prisma.opportunity.findMany({
      where: {
        ownerPersonId: id,
        stage: { notIn: ['completed', 'lost', 'not_interested'] },
      },
    });
    const futureWorkshops = await prisma.workshopAssignment.findMany({
      where: {
        personId: id,
        workshop: { scheduledDate: { gte: new Date() }, status: { in: ['confirmed', 'tentative'] } },
      },
      include: { workshop: true },
    });
    const advances = await prisma.advance.findMany({
      where: { personId: id, settled: false },
    });

    await logActivity({
      actor: req.user!,
      action: ActivityAction.permission_change,
      tableName: 'people',
      recordId: id,
      newValue: { isActive: false },
    });

    res.json({
      person: { id: updated.id, isActive: updated.isActive },
      handover: {
        opportunities: openOpps,
        futureWorkshops,
        unsettledAdvances: advances,
      },
    });
  }),
);
