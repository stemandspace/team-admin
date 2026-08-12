import { Router } from 'express';
import { prisma, ActivityAction } from '@team-admin/db';
import { clientSchema } from '@team-admin/shared';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireCommercialAccess } from '../middleware/auth';
import { logActivity } from '../services/common';
import { param } from '../utils/params';

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

clientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // Academic/support can see client name/city for scheduling only — limited fields
    const commercial = req.user!.team === 'sales' || req.user!.role === 'administrator' || req.user!.role === 'owner';
    if (commercial) {
      const rows = await prisma.client.findMany({ orderBy: { name: 'asc' } });
      return res.json(rows);
    }
    const rows = await prisma.client.findMany({
      select: { id: true, name: true, city: true, state: true, clientType: true },
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  }),
);

clientsRouter.post(
  '/',
  requireCommercialAccess,
  asyncHandler(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);

    // Duplicate check
    const normalized = parsed.data.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = await prisma.client.findMany();
    const match = existing.find(
      (c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized,
    );
    if (match && !req.body.overrideDuplicate) {
      return res.status(409).json({
        duplicate: true,
        client: match,
        message: 'Possible duplicate client. Pass overrideDuplicate with reason to proceed.',
      });
    }

    const client = await prisma.client.create({
      data: {
        name: parsed.data.name,
        clientType: parsed.data.clientType,
        city: parsed.data.city,
        state: parsed.data.state,
        board: parsed.data.board === 'Not applicable' ? 'Not_applicable' : (parsed.data.board as never),
        contactPerson: parsed.data.contactPerson || undefined,
        contactPhone: parsed.data.contactPhone || undefined,
        contactEmail: parsed.data.contactEmail || undefined,
        source: parsed.data.source || undefined,
      },
    });

    await logActivity({
      actor: req.user!,
      action: ActivityAction.insert,
      tableName: 'clients',
      recordId: client.id,
      reason: req.body.overrideDuplicate ? String(req.body.duplicateReason || '') : undefined,
      newValue: { name: client.name },
    });

    res.status(201).json(client);
  }),
);

clientsRouter.get(
  '/:id/delivery-history',
  requireCommercialAccess,
  asyncHandler(async (req, res) => {
    // Sales reads delivery one-way
    const workshops = await prisma.workshop.findMany({
      where: { clientId: param(req, 'id'), status: 'delivered' },
      include: {
        deliveryReports: true,
        assignments: {
          include: { person: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { scheduledDate: 'desc' },
    });
    res.json(workshops);
  }),
);
