import { Router } from 'express';
import { prisma, ActivityAction } from '@team-admin/db';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';
import { logActivity, parseDateOnly } from '../services/common';

export const holidaysRouter = Router();
holidaysRouter.use(requireAuth);

holidaysRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year || new Date().getFullYear());
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31));
    const rows = await prisma.holidayCalendar.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    res.json(rows);
  }),
);

holidaysRouter.post(
  '/',
  requireRole('administrator', 'owner'),
  asyncHandler(async (req, res) => {
    const row = await prisma.holidayCalendar.create({
      data: {
        date: parseDateOnly(req.body.date),
        name: req.body.name,
        type: req.body.type,
        appliesToCity: req.body.appliesToCity || null,
      },
    });
    await logActivity({
      actor: req.user!,
      action: ActivityAction.insert,
      tableName: 'holiday_calendar',
      recordId: row.id,
      newValue: row,
    });
    res.status(201).json(row);
  }),
);

holidaysRouter.post(
  '/alternate-saturdays',
  requireRole('administrator', 'owner'),
  asyncHandler(async (req, res) => {
    const year = Number(req.body.year);
    if (!year || !Array.isArray(req.body.saturdays)) {
      throw new AppError('year and saturdays[] required');
    }
    const created = [];
    for (const s of req.body.saturdays) {
      const type = s.working ? 'alternate_saturday_working' : 'alternate_saturday_off';
      const date = parseDateOnly(s.date);
      const existing = await prisma.holidayCalendar.findFirst({
        where: { date, type: type as never },
      });
      const row = existing
        ? await prisma.holidayCalendar.update({
            where: { id: existing.id },
            data: { name: s.working ? 'Working Saturday' : 'Alternate Saturday Off' },
          })
        : await prisma.holidayCalendar.create({
            data: {
              date,
              name: s.working ? 'Working Saturday' : 'Alternate Saturday Off',
              type: type as never,
            },
          });
      created.push(row);
    }
    res.json(created);
  }),
);
