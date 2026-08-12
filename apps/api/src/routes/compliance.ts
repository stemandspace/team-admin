import { Router } from 'express';
import { prisma, ActivityAction } from '@team-admin/db';
import { correctionRequestSchema, backdateRequestSchema } from '@team-admin/shared';
import { asyncHandler, AppError } from '../middleware/error';
import {
  requireAuth,
  requireApprover,
  requireActivityLogAccess,
} from '../middleware/auth';
import { logActivity, notify, parseDateOnly, serverNow } from '../services/common';
import { param } from '../utils/params';

export const complianceRouter = Router();
complianceRouter.use(requireAuth);

complianceRouter.post(
  '/corrections',
  asyncHandler(async (req, res) => {
    const parsed = correctionRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    const row = await prisma.correctionRequest.create({
      data: {
        tableName: parsed.data.tableName,
        recordId: parsed.data.recordId,
        requestedById: req.user!.id,
        fieldName: parsed.data.fieldName,
        currentValue: parsed.data.currentValue,
        proposedValue: parsed.data.proposedValue,
        reason: parsed.data.reason,
      },
    });
    const admins = await prisma.person.findMany({
      where: { role: { in: ['administrator', 'owner'] }, isActive: true },
    });
    for (const a of admins) {
      await notify({
        recipientPersonId: a.id,
        category: 'correction',
        title: 'Correction request',
        body: `${req.user!.fullName} wants to change ${parsed.data.fieldName}`,
        linkedRecordId: row.id,
        priority: 'action_required',
      });
    }
    res.status(201).json(row);
  }),
);

complianceRouter.get(
  '/corrections',
  requireApprover,
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.correctionRequest.findMany({
        include: {
          requestedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { requestedAt: 'desc' },
      }),
    );
  }),
);

complianceRouter.post(
  '/corrections/:id/decide',
  requireApprover,
  asyncHandler(async (req, res) => {
    const decision = req.body.decision as 'approved' | 'rejected';
    const row = await prisma.correctionRequest.findUnique({ where: { id: param(req, 'id') } });
    if (!row || row.status !== 'pending') throw new AppError('Invalid request');

    if (decision === 'approved') {
      // Apply known tables dynamically for day_record common fields
      if (row.tableName === 'day_record') {
        await prisma.dayRecord.update({
          where: { id: row.recordId },
          data: {
            [row.fieldName]: coerceValue(row.proposedValue),
            wasAmended: true,
          } as never,
        });
      }
    }

    const updated = await prisma.correctionRequest.update({
      where: { id: row.id },
      data: {
        status: decision,
        reviewedById: req.user!.id,
        reviewedAt: serverNow(),
        reviewerComment: req.body.comment,
      },
    });

    await logActivity({
      actor: req.user!,
      action: decision === 'approved' ? ActivityAction.approve : ActivityAction.reject,
      tableName: 'correction_requests',
      recordId: row.id,
      oldValue: { [row.fieldName]: row.currentValue },
      newValue: { [row.fieldName]: row.proposedValue },
      linkedCorrectionId: row.id,
      reason: row.reason,
    });

    await notify({
      recipientPersonId: row.requestedById,
      category: 'correction',
      title: `Correction ${decision}`,
      body: req.body.comment || '',
      linkedRecordId: row.id,
    });

    res.json(updated);
  }),
);

complianceRouter.post(
  '/backdates',
  asyncHandler(async (req, res) => {
    const parsed = backdateRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    const target = parseDateOnly(parsed.data.targetDate);
    const daysLate = Math.max(
      0,
      Math.floor((Date.now() - target.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const row = await prisma.backdateRequest.create({
      data: {
        tableName: parsed.data.tableName,
        requestedById: req.user!.id,
        targetDate: target,
        daysLate,
        recordPayload: parsed.data.recordPayload as object,
        reason: parsed.data.reason,
      },
    });
    res.status(201).json(row);
  }),
);

complianceRouter.get(
  '/backdates',
  requireApprover,
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.backdateRequest.findMany({
        include: { requestedBy: { select: { id: true, fullName: true } } },
        orderBy: { requestedAt: 'desc' },
      }),
    );
  }),
);

complianceRouter.post(
  '/backdates/:id/decide',
  requireApprover,
  asyncHandler(async (req, res) => {
    const decision = req.body.decision as 'approved' | 'rejected';
    const row = await prisma.backdateRequest.findUnique({ where: { id: param(req, 'id') } });
    if (!row || row.status !== 'pending') throw new AppError('Invalid request');

    if (decision === 'approved' && row.tableName === 'day_record') {
      const payload = row.recordPayload as Record<string, unknown>;
      await prisma.dayRecord.create({
        data: {
          personId: row.requestedById,
          date: row.targetDate,
          status: (payload.status as never) || 'present_office',
          wasBackdated: true,
          daysLate: row.daysLate,
          isLocked: true,
          submittedAt: serverNow(),
          createdById: req.user!.id,
          notes: String(payload.notes || ''),
        },
      });
    }

    const updated = await prisma.backdateRequest.update({
      where: { id: row.id },
      data: {
        status: decision,
        reviewedById: req.user!.id,
        reviewedAt: serverNow(),
        reviewerComment: req.body.comment,
      },
    });

    await logActivity({
      actor: req.user!,
      action: decision === 'approved' ? ActivityAction.approve : ActivityAction.reject,
      tableName: 'backdate_requests',
      recordId: row.id,
      linkedBackdateId: row.id,
    });

    res.json(updated);
  }),
);

complianceRouter.get(
  '/activity-log',
  requireActivityLogAccess,
  asyncHandler(async (req, res) => {
    const rows = await prisma.activityLog.findMany({
      where: {
        ...(req.query.personId
          ? { actorPersonId: String(req.query.personId) }
          : {}),
        ...(req.query.action ? { action: String(req.query.action) as never } : {}),
      },
      include: {
        actor: { select: { id: true, fullName: true, employeeCode: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
    res.json(rows);
  }),
);

complianceRouter.get(
  '/dashboard',
  requireApprover,
  asyncHandler(async (_req, res) => {
    const pendingCorrections = await prisma.correctionRequest.count({
      where: { status: 'pending' },
    });
    const pendingBackdates = await prisma.backdateRequest.count({
      where: { status: 'pending' },
    });
    const missingPunchOuts = await prisma.dayRecord.count({
      where: {
        punchInTime: { not: null },
        punchOutTime: null,
        date: { lt: new Date() },
      },
    });
    const missingReports = await prisma.workshop.count({
      where: {
        status: 'confirmed',
        scheduledDate: { lt: new Date() },
        deliveryReports: { none: {} },
      },
    });
    res.json({
      pendingCorrections,
      pendingBackdates,
      missingPunchOuts,
      missingReports,
    });
  }),
);

function coerceValue(v: string) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (!Number.isNaN(Number(v)) && v.trim() !== '') return Number(v);
  return v;
}
