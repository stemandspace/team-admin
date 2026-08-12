import { Router } from 'express';
import { prisma, ActivityAction, BoardType } from '@team-admin/db';
import { clientSchema } from '@team-admin/shared';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireCommercialAccess } from '../middleware/auth';
import { logActivity } from '../services/common';
import { param } from '../utils/params';

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

function mapBoard(board?: string | null): BoardType {
  if (!board || board === 'Not applicable') return BoardType.Not_applicable;
  return board as BoardType;
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toClientPayload(data: {
  name: string;
  clientType: string;
  city: string;
  state: string;
  board?: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  source?: string | null;
}) {
  return {
    name: data.name.trim(),
    clientType: data.clientType as never,
    city: data.city.trim(),
    state: data.state.trim(),
    board: mapBoard(data.board),
    contactPerson: data.contactPerson?.trim() || null,
    contactPhone: data.contactPhone?.trim() || null,
    contactEmail: data.contactEmail?.trim() || null,
    source: data.source?.trim() || null,
  };
}

clientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const commercial =
      req.user!.team === 'sales' ||
      req.user!.role === 'administrator' ||
      req.user!.role === 'owner';
    const q = req.query.q ? String(req.query.q).trim() : '';

    if (commercial) {
      const rows = await prisma.client.findMany({
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
                { contactPerson: { contains: q, mode: 'insensitive' } },
              ],
            }
          : undefined,
        include: {
          _count: {
            select: { opportunities: true, workshops: true, engagements: true },
          },
        },
        orderBy: { name: 'asc' },
      });
      return res.json(rows);
    }

    const rows = await prisma.client.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: { id: true, name: true, city: true, state: true, clientType: true },
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  }),
);

clientsRouter.get(
  '/:id',
  requireCommercialAccess,
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: param(req, 'id') },
      include: {
        contacts: true,
        opportunities: {
          include: { program: true, owner: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: { opportunities: true, workshops: true, engagements: true },
        },
      },
    });
    if (!client) throw new AppError('Client not found', 404);
    res.json(client);
  }),
);

clientsRouter.post(
  '/',
  requireCommercialAccess,
  asyncHandler(async (req, res) => {
    const parsed = clientSchema.safeParse({
      ...req.body,
      contactEmail: req.body.contactEmail || null,
    });
    if (!parsed.success) throw new AppError(parsed.error.message);

    const normalized = normalizeName(parsed.data.name);
    const existing = await prisma.client.findMany({ select: { id: true, name: true } });
    const match = existing.find((c) => normalizeName(c.name) === normalized);
    if (match && !req.body.overrideDuplicate) {
      return res.status(409).json({
        duplicate: true,
        client: match,
        error: 'Possible duplicate client. Pass overrideDuplicate with reason to proceed.',
        message: 'Possible duplicate client. Pass overrideDuplicate with reason to proceed.',
      });
    }

    const client = await prisma.client.create({
      data: toClientPayload(parsed.data),
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

clientsRouter.patch(
  '/:id',
  requireCommercialAccess,
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) throw new AppError('Client not found', 404);

    const parsed = clientSchema.safeParse({
      ...req.body,
      contactEmail: req.body.contactEmail || null,
    });
    if (!parsed.success) throw new AppError(parsed.error.message);

    const normalized = normalizeName(parsed.data.name);
    const clash = await prisma.client.findFirst({
      where: {
        id: { not: id },
        name: { equals: parsed.data.name, mode: 'insensitive' },
      },
    });
    // soft check via normalized compare
    if (!clash) {
      const others = await prisma.client.findMany({
        where: { id: { not: id } },
        select: { id: true, name: true },
      });
      const dup = others.find((c) => normalizeName(c.name) === normalized);
      if (dup && !req.body.overrideDuplicate) {
        return res.status(409).json({
          duplicate: true,
          client: dup,
          error: 'Another client with a similar name exists.',
          message: 'Another client with a similar name exists.',
        });
      }
    } else if (!req.body.overrideDuplicate) {
      return res.status(409).json({
        duplicate: true,
        client: clash,
        error: 'Another client with a similar name exists.',
        message: 'Another client with a similar name exists.',
      });
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...toClientPayload(parsed.data),
        ...(req.body.lifecycleStatus
          ? { lifecycleStatus: req.body.lifecycleStatus as never }
          : {}),
      },
    });

    await logActivity({
      actor: req.user!,
      action: ActivityAction.update,
      tableName: 'clients',
      recordId: id,
      oldValue: existing,
      newValue: updated,
    });

    res.json(updated);
  }),
);

clientsRouter.delete(
  '/:id',
  requireCommercialAccess,
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const force = String(req.query.force || '') === '1';
    const existing = await prisma.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: { opportunities: true, workshops: true, engagements: true },
        },
      },
    });
    if (!existing) throw new AppError('Client not found', 404);

    const linked =
      existing._count.opportunities + existing._count.workshops + existing._count.engagements;
    if (linked > 0 || !force) {
      const updated = await prisma.client.update({
        where: { id },
        data: { lifecycleStatus: 'lost' },
      });
      await logActivity({
        actor: req.user!,
        action: ActivityAction.update,
        tableName: 'clients',
        recordId: id,
        reason: linked > 0
          ? 'Soft-deleted (marked lost) because linked records exist'
          : 'Soft-deleted (marked lost)',
        newValue: { lifecycleStatus: 'lost' },
      });
      return res.json({
        softDeleted: true,
        client: updated,
        message:
          linked > 0
            ? 'Client has linked records, so it was marked as lost instead of deleted.'
            : 'Client marked as lost.',
      });
    }

    await prisma.client.delete({ where: { id } });
    await logActivity({
      actor: req.user!,
      action: ActivityAction.void,
      tableName: 'clients',
      recordId: id,
      oldValue: { name: existing.name },
    });
    res.json({ ok: true, deleted: true });
  }),
);

clientsRouter.get(
  '/:id/delivery-history',
  requireCommercialAccess,
  asyncHandler(async (req, res) => {
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
