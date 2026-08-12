import { Router } from 'express';
import { punchSchema, shortAbsenceSchema } from '@team-admin/shared';
import { prisma, ActivityAction } from '@team-admin/db';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireApprover } from '../middleware/auth';
import * as attendance from '../services/attendance';
import { logActivity, notify, parseDateOnly, serverNow } from '../services/common';
import { param } from '../utils/params';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

attendanceRouter.get(
  '/today',
  asyncHandler(async (req, res) => {
    res.json(await attendance.getToday(req.user!));
  }),
);

attendanceRouter.post(
  '/punch-in',
  asyncHandler(async (req, res) => {
    const parsed = punchSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    const record = await attendance.punchIn(req.user!, {
      workLocation: parsed.data.workLocation as never,
      punchInLat: parsed.data.punchInLat,
      punchInLng: parsed.data.punchInLng,
      lateReason: parsed.data.lateReason,
    });
    res.json(record);
  }),
);

attendanceRouter.post(
  '/punch-out',
  asyncHandler(async (req, res) => {
    res.json(await attendance.punchOut(req.user!));
  }),
);

attendanceRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    res.json(
      await attendance.getMyAttendance(
        req.user!,
        req.query.from ? String(req.query.from) : undefined,
        req.query.to ? String(req.query.to) : undefined,
      ),
    );
  }),
);

attendanceRouter.get(
  '/team',
  requireApprover,
  asyncHandler(async (req, res) => {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (!from || !to) throw new AppError('from and to required');
    res.json(await attendance.getTeamAttendance(req.user!, from, to));
  }),
);

attendanceRouter.post(
  '/step-out/request',
  asyncHandler(async (req, res) => {
    const parsed = shortAbsenceSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    const row = await prisma.shortAbsenceRequest.create({
      data: {
        personId: req.user!.id,
        date: parseDateOnly(parsed.data.date),
        category: parsed.data.category,
        reason: parsed.data.reason,
        expectedOutTime: parsed.data.expectedOutTime,
        expectedDurationMinutes: parsed.data.expectedDurationMinutes,
        wasRetrospective: parsed.data.wasRetrospective,
        status: 'pending',
      },
    });
    const managers = await prisma.person.findMany({
      where: { role: { in: ['administrator', 'owner'] }, isActive: true },
    });
    for (const m of managers) {
      await notify({
        recipientPersonId: m.id,
        category: 'step_out',
        title: 'Step-out approval',
        body: `${req.user!.fullName}: ${parsed.data.reason.slice(0, 80)}`,
        linkedRecordId: row.id,
        priority: 'action_required',
      });
    }
    res.status(201).json(row);
  }),
);

attendanceRouter.post(
  '/step-out/:id/decide',
  requireApprover,
  asyncHandler(async (req, res) => {
    const decision = req.body.decision as 'approved' | 'rejected';
    const row = await prisma.shortAbsenceRequest.update({
      where: { id: param(req, 'id') },
      data: {
        status: decision,
        approverId: req.user!.id,
        approvedAt: serverNow(),
        approverComment: req.body.comment,
      },
    });
    await notify({
      recipientPersonId: row.personId,
      category: 'step_out',
      title: `Step-out ${decision}`,
      body: req.body.comment || '',
      linkedRecordId: row.id,
    });
    res.json(row);
  }),
);

attendanceRouter.post(
  '/step-out/:id/tap-out',
  asyncHandler(async (req, res) => {
    const row = await prisma.shortAbsenceRequest.findUnique({ where: { id: param(req, 'id') } });
    if (!row || row.personId !== req.user!.id) throw new AppError('Not found', 404);
    if (row.status !== 'approved' && row.status !== 'active') {
      throw new AppError('Must be approved first');
    }
    const updated = await prisma.shortAbsenceRequest.update({
      where: { id: row.id },
      data: { actualOutTime: serverNow(), status: 'active' },
    });
    res.json(updated);
  }),
);

attendanceRouter.post(
  '/step-out/:id/tap-in',
  asyncHandler(async (req, res) => {
    const row = await prisma.shortAbsenceRequest.findUnique({ where: { id: param(req, 'id') } });
    if (!row || row.personId !== req.user!.id) throw new AppError('Not found', 404);
    if (!row.actualOutTime) throw new AppError('Tap out first');
    const now = serverNow();
    const actualDurationMinutes = Math.round(
      (now.getTime() - row.actualOutTime.getTime()) / 60000,
    );
    const overrunMinutes = Math.max(
      0,
      actualDurationMinutes - row.expectedDurationMinutes,
    );
    const updated = await prisma.shortAbsenceRequest.update({
      where: { id: row.id },
      data: {
        actualReturnTime: now,
        actualDurationMinutes,
        overrunMinutes,
        status: 'closed',
      },
    });
    await logActivity({
      actor: req.user!,
      action: ActivityAction.update,
      tableName: 'short_absence_requests',
      recordId: row.id,
      newValue: { actualDurationMinutes },
    });
    res.json(updated);
  }),
);

attendanceRouter.post(
  '/travel/start',
  asyncHandler(async (req, res) => {
    const today = await attendance.getToday(req.user!);
    if (!today.record) throw new AppError('No day record for travel');
    const updated = await prisma.dayRecord.update({
      where: { id: today.record.id },
      data: {
        status: 'official_travel',
        travelStartAt: serverNow(),
        workLocation: 'travel',
      },
    });
    res.json(updated);
  }),
);

attendanceRouter.post(
  '/travel/return',
  asyncHandler(async (req, res) => {
    const today = await attendance.getToday(req.user!);
    if (!today.record?.travelStartAt) throw new AppError('Start travel first');
    const now = serverNow();
    let varianceMinutes: number | undefined;
    if (today.record.travelPlannedReturn) {
      varianceMinutes = Math.round(
        (now.getTime() - today.record.travelPlannedReturn.getTime()) / 60000,
      );
    }
    const offerRest = (varianceMinutes || 0) > 120;
    const updated = await prisma.dayRecord.update({
      where: { id: today.record.id },
      data: {
        travelReturnAt: now,
        varianceMinutes,
        restHalfDayOffered: offerRest,
      },
    });
    if (offerRest) {
      await notify({
        recipientPersonId: req.user!.id,
        category: 'travel',
        title: 'Rest half-day offered',
        body: 'Late return — rest half-day offered (expires next morning).',
        priority: 'action_required',
      });
    }
    res.json(updated);
  }),
);
