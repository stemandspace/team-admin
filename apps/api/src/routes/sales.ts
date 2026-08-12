import { Router } from 'express';
import { prisma, ActivityAction, OpportunityStage } from '@team-admin/db';
import {
  opportunitySchema,
  interactionSchema,
  canSeeOpportunity,
} from '@team-admin/shared';
import { asyncHandler, AppError } from '../middleware/error';
import {
  requireAuth,
  requireCommercialAccess,
  requireApprover,
  toVisibility,
} from '../middleware/auth';
import {
  getPolicyNumber,
  logActivity,
  notify,
  parseDateOnly,
  serverNow,
  startOfToday,
  isSameCalendarDay,
} from '../services/common';
import { param } from '../utils/params';

export const salesRouter = Router();
salesRouter.use(requireAuth);
salesRouter.use(requireCommercialAccess);

salesRouter.get(
  '/programs',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.program.findMany({ where: { isActive: true } }));
  }),
);

salesRouter.get(
  '/opportunities',
  asyncHandler(async (req, res) => {
    const where =
      req.user!.role === 'employee'
        ? { ownerPersonId: req.user!.id }
        : {};
    const rows = await prisma.opportunity.findMany({
      where,
      include: {
        client: true,
        program: true,
        contact: true,
        linkedEngagement: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  }),
);

salesRouter.post(
  '/opportunities',
  asyncHandler(async (req, res) => {
    const parsed = opportunitySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);

    const existing = await prisma.opportunity.findUnique({
      where: {
        clientId_programId: {
          clientId: parsed.data.clientId,
          programId: parsed.data.programId,
        },
      },
    });
    if (existing) {
      throw new AppError('Opportunity already exists for this client+program');
    }

    const row = await prisma.opportunity.create({
      data: {
        clientId: parsed.data.clientId,
        contactId: parsed.data.contactId || undefined,
        programId: parsed.data.programId,
        ownerPersonId: req.user!.id,
        stage: parsed.data.stage as OpportunityStage,
        expectedValue: parsed.data.expectedValue,
        expectedStudents: parsed.data.expectedStudents || undefined,
        expectedCloseDate: parsed.data.expectedCloseDate
          ? parseDateOnly(parsed.data.expectedCloseDate)
          : undefined,
        expectedDeliveryWindowStart: parsed.data.expectedDeliveryWindowStart
          ? parseDateOnly(parsed.data.expectedDeliveryWindowStart)
          : undefined,
        expectedDeliveryWindowEnd: parsed.data.expectedDeliveryWindowEnd
          ? parseDateOnly(parsed.data.expectedDeliveryWindowEnd)
          : undefined,
      },
    });

    await logActivity({
      actor: req.user!,
      action: ActivityAction.insert,
      tableName: 'opportunities',
      recordId: row.id,
    });

    res.status(201).json(row);
  }),
);

salesRouter.post(
  '/opportunities/:id/stage',
  asyncHandler(async (req, res) => {
    const stage = req.body.stage as OpportunityStage;
    const opp = await prisma.opportunity.findUnique({
      where: { id: param(req, 'id') },
      include: { program: true, client: true },
    });
    if (!opp) throw new AppError('Not found', 404);
    if (
      !canSeeOpportunity(toVisibility(req.user!), opp.ownerPersonId) &&
      req.user!.role === 'employee'
    ) {
      throw new AppError('Forbidden', 403);
    }

    let linkedEngagementId = opp.linkedEngagementId;
    if (stage === 'registered' && !linkedEngagementId) {
      const engagement = await prisma.engagement.create({
        data: {
          clientId: opp.clientId,
          title: `${opp.client.name} — ${opp.program.name}`,
          programId: opp.programId,
          expectedStudents: opp.expectedStudents || undefined,
          deliveryWindowStart: opp.expectedDeliveryWindowStart || undefined,
          deliveryWindowEnd: opp.expectedDeliveryWindowEnd || undefined,
          expectedValue: opp.expectedValue,
          totalRevenueCollected: 0,
        },
      });
      linkedEngagementId = engagement.id;
    }

    if (stage === 'completed') {
      throw new AppError(
        'Completed is set automatically when all workshops are delivered',
      );
    }

    const updated = await prisma.opportunity.update({
      where: { id: opp.id },
      data: { stage, linkedEngagementId: linkedEngagementId || undefined },
    });

    res.json(updated);
  }),
);

salesRouter.post(
  '/interactions',
  asyncHandler(async (req, res) => {
    const parsed = interactionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);

    const today = startOfToday();
    if (!isSameCalendarDay(serverNow(), today)) {
      // always same day by definition of serverNow vs today — check logged intent
    }
    // Same-day only: interactions cannot be backdated via this endpoint
    const now = serverNow();

    const opp = await prisma.opportunity.findUnique({
      where: { id: parsed.data.opportunityId },
    });
    if (!opp) throw new AppError('Opportunity not found', 404);
    if (
      req.user!.role === 'employee' &&
      opp.ownerPersonId !== req.user!.id
    ) {
      throw new AppError('Forbidden', 403);
    }

    const row = await prisma.interaction.create({
      data: {
        opportunityId: parsed.data.opportunityId,
        contactId: parsed.data.contactId || undefined,
        personId: req.user!.id,
        communicationMode: parsed.data.communicationMode as never,
        interactionType: parsed.data.interactionType as never,
        outcome: parsed.data.outcome as never,
        notes: parsed.data.notes,
        stageBefore: opp.stage,
        stageAfter: (parsed.data.stageAfter as OpportunityStage) || undefined,
        nextFollowUpDate: parsed.data.nextFollowUpDate
          ? parseDateOnly(parsed.data.nextFollowUpDate)
          : undefined,
        occurredAt: now,
        loggedAt: now,
        isLocked: true,
      },
    });

    await prisma.opportunity.update({
      where: { id: opp.id },
      data: {
        lastInteractionAt: now,
        dormantSince: null,
        ...(parsed.data.stageAfter
          ? { stage: parsed.data.stageAfter as OpportunityStage }
          : {}),
      },
    });

    // Physical meeting outstation → official_travel on day_record
    if (parsed.data.communicationMode === 'physical_meeting' && req.body.outstation) {
      await prisma.dayRecord.upsert({
        where: {
          personId_date: { personId: req.user!.id, date: today },
        },
        update: { status: 'official_travel', workLocation: 'travel' },
        create: {
          personId: req.user!.id,
          date: today,
          status: 'official_travel',
          workLocation: 'travel',
          createdById: req.user!.id,
        },
      });
    }

    await logActivity({
      actor: req.user!,
      action: ActivityAction.insert,
      tableName: 'interactions',
      recordId: row.id,
    });

    res.status(201).json(row);
  }),
);

salesRouter.get(
  '/follow-ups',
  asyncHandler(async (req, res) => {
    const whereOwner =
      req.user!.role === 'employee' ? { personId: req.user!.id } : {};
    const rows = await prisma.interaction.findMany({
      where: {
        ...whereOwner,
        nextFollowUpDate: { not: null },
        followUpCompleted: false,
      },
      include: {
        opportunity: { include: { client: true, program: true } },
      },
      orderBy: { nextFollowUpDate: 'asc' },
    });

    const today = startOfToday();
    const enriched = [];
    for (const r of rows) {
      const leave = await prisma.dayRecord.findFirst({
        where: {
          personId: r.personId,
          date: r.nextFollowUpDate!,
          status: { in: ['leave_full', 'leave_half', 'official_travel'] },
        },
      });
      const overdue = r.nextFollowUpDate! < today && !leave;
      enriched.push({
        ...r,
        statusFlag: leave ? 'covered' : overdue ? 'overdue' : 'upcoming',
      });
    }
    res.json(enriched);
  }),
);

salesRouter.get(
  '/capacity',
  asyncHandler(async (req, res) => {
    const city = String(req.query.city || '');
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (!city || !from || !to) throw new AppError('city, from, to required');

    const educators = await prisma.person.findMany({
      where: { team: 'academic', isActive: true, baseCity: city },
      select: { id: true },
    });
    const dates: string[] = [];
    let cur = parseDateOnly(from);
    const end = parseDateOnly(to);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur = new Date(cur);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const result = [];
    for (const d of dates) {
      const date = parseDateOnly(d);
      const busy = await prisma.dayRecord.count({
        where: {
          personId: { in: educators.map((e) => e.id) },
          date,
          status: {
            in: [
              'leave_full',
              'workshop_delivery',
              'official_travel',
              'holiday',
              'weekly_off',
              'absent',
            ],
          },
        },
      });
      const tentative = await prisma.opportunity.count({
        where: {
          expectedDeliveryWindowStart: { lte: date },
          expectedDeliveryWindowEnd: { gte: date },
          stage: { in: ['interested', 'proposal_shared', 'follow_up_required'] },
        },
      });
      const firm = await prisma.opportunity.count({
        where: {
          expectedDeliveryWindowStart: { lte: date },
          expectedDeliveryWindowEnd: { gte: date },
          stage: 'registered',
        },
      });
      result.push({
        date: d,
        totalEducators: educators.length,
        availableSlots: Math.max(0, educators.length - busy),
        tentativeHolds: tentative,
        firmBookings: firm,
      });
    }
    res.json(result);
  }),
);

salesRouter.get(
  '/dormant',
  requireApprover,
  asyncHandler(async (_req, res) => {
    const threshold = await getPolicyNumber('dormancy_threshold_days', 90);
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - threshold);
    const rows = await prisma.opportunity.findMany({
      where: {
        OR: [
          { lastInteractionAt: { lt: cutoff } },
          { lastInteractionAt: null, createdAt: { lt: cutoff } },
        ],
        stage: { notIn: ['completed', 'lost', 'not_interested', 'registered'] },
      },
      include: { client: true, program: true, owner: { select: { fullName: true } } },
    });
    res.json(rows);
  }),
);

salesRouter.post(
  '/opportunities/:id/reassign',
  requireApprover,
  asyncHandler(async (req, res) => {
    const opp = await prisma.opportunity.findUnique({ where: { id: param(req, 'id') } });
    if (!opp) throw new AppError('Not found', 404);
    const updated = await prisma.opportunity.update({
      where: { id: opp.id },
      data: {
        reassignedFromPersonId: opp.ownerPersonId,
        ownerPersonId: req.body.toPersonId,
        reassignedAt: serverNow(),
        reassignmentReason: req.body.reason || 'Admin reassignment',
      },
    });
    await notify({
      recipientPersonId: req.body.toPersonId,
      category: 'sales',
      title: 'Opportunity reassigned to you',
      body: req.body.reason || '',
      linkedRecordId: opp.id,
      priority: 'action_required',
    });
    res.json(updated);
  }),
);

salesRouter.get(
  '/targets',
  asyncHandler(async (req, res) => {
    const where =
      req.user!.role === 'employee'
        ? { personId: req.user!.id }
        : {};
    res.json(await prisma.salesTarget.findMany({ where, include: { program: true } }));
  }),
);

salesRouter.post(
  '/targets',
  requireApprover,
  asyncHandler(async (req, res) => {
    const row = await prisma.salesTarget.create({
      data: {
        personId: req.body.personId,
        month: parseDateOnly(req.body.month),
        programId: req.body.programId || undefined,
        targetValue: req.body.targetValue,
        targetRegistrations: req.body.targetRegistrations,
        setById: req.user!.id,
      },
    });
    res.status(201).json(row);
  }),
);

salesRouter.get(
  '/contacts',
  asyncHandler(async (req, res) => {
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    res.json(
      await prisma.contact.findMany({
        where: clientId ? { clientId } : {},
        orderBy: { name: 'asc' },
      }),
    );
  }),
);

salesRouter.post(
  '/contacts',
  asyncHandler(async (req, res) => {
    const row = await prisma.contact.create({
      data: {
        clientId: req.body.clientId,
        name: req.body.name,
        designation: req.body.designation,
        mobile: req.body.mobile,
        email: req.body.email,
        isPrimary: !!req.body.isPrimary,
        preferredChannel: req.body.preferredChannel,
        notes: req.body.notes,
        createdById: req.user!.id,
      },
    });
    res.status(201).json(row);
  }),
);
