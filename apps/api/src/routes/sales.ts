import { Router } from 'express';
import { prisma, ActivityAction, OpportunityStage, Prisma } from '@team-admin/db';
import {
  opportunitySchema,
  opportunityPatchSchema,
  interactionSchema,
  programSchema,
  contactSchema,
  salesUnavailabilitySchema,
  nilReportSchema,
  CRM_RULES_COPY,
  CRM_DEFAULTS,
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
} from '../services/common';
import { param } from '../utils/params';
import {
  assertCanCreateOpportunity,
  assertSchoolContacts,
  enrichOpportunity,
  findDuplicateClients,
  logInteraction,
  markWon,
  recordSalesActivity,
  requireEditAccess,
  validateClientName,
  applyAgeingSweep,
} from '../services/salesCrm';

export const salesRouter = Router();
salesRouter.use(requireAuth);
salesRouter.use(requireCommercialAccess);

salesRouter.get(
  '/programs',
  asyncHandler(async (req, res) => {
    const includeInactive = String(req.query.includeInactive || '') === '1';
    const q = req.query.q ? String(req.query.q).trim() : '';
    const rows = await prisma.program.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: {
        _count: {
          select: { opportunities: true, engagements: true, salesTargets: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  }),
);

salesRouter.get(
  '/programs/:id',
  asyncHandler(async (req, res) => {
    const program = await prisma.program.findUnique({
      where: { id: param(req, 'id') },
      include: {
        _count: {
          select: { opportunities: true, engagements: true, salesTargets: true },
        },
      },
    });
    if (!program) throw new AppError('Program not found', 404);
    res.json(program);
  }),
);

salesRouter.post(
  '/programs',
  asyncHandler(async (req, res) => {
    const parsed = programSchema.safeParse({
      ...req.body,
      defaultPrice:
        req.body.defaultPrice === '' || req.body.defaultPrice == null
          ? null
          : Number(req.body.defaultPrice),
      mapsToWorkshopCategory: req.body.mapsToWorkshopCategory || null,
      priceUnit: req.body.priceUnit || null,
    });
    if (!parsed.success) throw new AppError(parsed.error.message);

    const clash = await prisma.program.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
    });
    if (clash) throw new AppError('A program with this name already exists', 409);

    const program = await prisma.program.create({
      data: {
        name: parsed.data.name.trim(),
        programFamily: parsed.data.programFamily,
        audience: parsed.data.audience,
        deliveryModeSupported: parsed.data.deliveryModeSupported,
        defaultPrice: parsed.data.defaultPrice ?? null,
        priceUnit: parsed.data.priceUnit?.trim() || null,
        mapsToWorkshopCategory: parsed.data.mapsToWorkshopCategory ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await logActivity({
      actor: req.user!,
      action: ActivityAction.insert,
      tableName: 'programs',
      recordId: program.id,
      newValue: { name: program.name },
    });

    res.status(201).json(program);
  }),
);

salesRouter.patch(
  '/programs/:id',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const existing = await prisma.program.findUnique({ where: { id } });
    if (!existing) throw new AppError('Program not found', 404);

    const parsed = programSchema.safeParse({
      ...req.body,
      defaultPrice:
        req.body.defaultPrice === '' || req.body.defaultPrice == null
          ? null
          : Number(req.body.defaultPrice),
      mapsToWorkshopCategory: req.body.mapsToWorkshopCategory || null,
      priceUnit: req.body.priceUnit || null,
    });
    if (!parsed.success) throw new AppError(parsed.error.message);

    const clash = await prisma.program.findFirst({
      where: {
        id: { not: id },
        name: { equals: parsed.data.name, mode: 'insensitive' },
      },
    });
    if (clash) throw new AppError('A program with this name already exists', 409);

    const updated = await prisma.program.update({
      where: { id },
      data: {
        name: parsed.data.name.trim(),
        programFamily: parsed.data.programFamily,
        audience: parsed.data.audience,
        deliveryModeSupported: parsed.data.deliveryModeSupported,
        defaultPrice: parsed.data.defaultPrice ?? null,
        priceUnit: parsed.data.priceUnit?.trim() || null,
        mapsToWorkshopCategory: parsed.data.mapsToWorkshopCategory ?? null,
        ...(typeof parsed.data.isActive === 'boolean'
          ? { isActive: parsed.data.isActive }
          : {}),
      },
    });

    await logActivity({
      actor: req.user!,
      action: ActivityAction.update,
      tableName: 'programs',
      recordId: id,
      oldValue: existing,
      newValue: updated,
    });

    res.json(updated);
  }),
);

salesRouter.delete(
  '/programs/:id',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const existing = await prisma.program.findUnique({
      where: { id },
      include: {
        _count: {
          select: { opportunities: true, engagements: true, salesTargets: true },
        },
      },
    });
    if (!existing) throw new AppError('Program not found', 404);

    const linked =
      existing._count.opportunities +
      existing._count.engagements +
      existing._count.salesTargets;

    // Soft-deactivate by default; hard delete only when unused and force=1
    const force = String(req.query.force || '') === '1';
    if (linked > 0 || !force) {
      const updated = await prisma.program.update({
        where: { id },
        data: { isActive: false },
      });
      await logActivity({
        actor: req.user!,
        action: ActivityAction.update,
        tableName: 'programs',
        recordId: id,
        reason:
          linked > 0
            ? 'Deactivated because linked records exist'
            : 'Deactivated program',
        newValue: { isActive: false },
      });
      return res.json({
        softDeleted: true,
        program: updated,
        message:
          linked > 0
            ? 'Program has linked records, so it was deactivated instead of deleted.'
            : 'Program deactivated.',
      });
    }

    await prisma.program.delete({ where: { id } });
    await logActivity({
      actor: req.user!,
      action: ActivityAction.void,
      tableName: 'programs',
      recordId: id,
      oldValue: { name: existing.name },
    });
    res.json({ ok: true, deleted: true });
  }),
);

salesRouter.get(
  '/opportunities',
  asyncHandler(async (req, res) => {
    // Shared visibility: all commercial users see the pipeline; mine=1 filters to owned
    const mine = String(req.query.mine || '') === '1';
    const stage = req.query.stage ? String(req.query.stage) : undefined;
    const q = req.query.q ? String(req.query.q).trim() : '';
    const where: Record<string, unknown> = {};
    if (mine || (req.user!.role === 'employee' && String(req.query.scope || '') === 'mine')) {
      where.ownerPersonId = req.user!.id;
    }
    if (stage) where.stage = stage;
    if (q) {
      where.OR = [
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { client: { city: { contains: q, mode: 'insensitive' } } },
        { client: { contactPhone: { contains: q } } },
      ];
    }

    const rows = await prisma.opportunity.findMany({
      where,
      include: {
        client: true,
        program: true,
        contact: true,
        decisionMaker: true,
        coordinator: true,
        owner: { select: { id: true, fullName: true, email: true } },
        linkedEngagement: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.json(rows.map((r) => enrichOpportunity(r)));
  }),
);

salesRouter.get(
  '/opportunities/:id',
  asyncHandler(async (req, res) => {
    const opp = await prisma.opportunity.findUnique({
      where: { id: param(req, 'id') },
      include: {
        client: { include: { contacts: true } },
        program: true,
        contact: true,
        decisionMaker: true,
        coordinator: true,
        owner: { select: { id: true, fullName: true, email: true } },
        interactions: { orderBy: { occurredAt: 'desc' }, take: 50 },
        linkedEngagement: true,
        priorOpportunity: true,
      },
    });
    if (!opp) throw new AppError('Not found', 404);
    res.json(enrichOpportunity(opp));
  }),
);

salesRouter.post(
  '/opportunities',
  asyncHandler(async (req, res) => {
    const parsed = opportunitySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);

    const program = await prisma.program.findUnique({ where: { id: parsed.data.programId } });
    if (!program || !program.isActive) throw new AppError('Program not found', 404);

    await assertCanCreateOpportunity({
      actor: req.user!,
      clientId: parsed.data.clientId,
      programId: parsed.data.programId,
      overrideConflict: parsed.data.overrideConflict,
      overrideReason: parsed.data.overrideReason,
    });

    if (parsed.data.stage && parsed.data.stage !== 'lead') {
      assertSchoolContacts({
        audience: program.audience,
        decisionMakerContactId: parsed.data.decisionMakerContactId,
        coordinatorContactId: parsed.data.coordinatorContactId,
        stage: parsed.data.stage,
      });
    }

    const now = serverNow();
    const row = await prisma.opportunity.create({
      data: {
        clientId: parsed.data.clientId,
        contactId: parsed.data.contactId || undefined,
        decisionMakerContactId: parsed.data.decisionMakerContactId || undefined,
        coordinatorContactId: parsed.data.coordinatorContactId || undefined,
        programId: parsed.data.programId,
        ownerPersonId: req.user!.id,
        creditedPersonId: req.user!.id,
        stage: (parsed.data.stage as OpportunityStage) || 'lead',
        leadSource: parsed.data.leadSource || 'outbound',
        probability: parsed.data.probability || 25,
        expectedValue: parsed.data.expectedValue || 0,
        quotedValue: parsed.data.quotedValue ?? undefined,
        expectedStudents: parsed.data.expectedStudents || undefined,
        expectedRegistrations: parsed.data.expectedRegistrations || undefined,
        expectedCloseDate: parsed.data.expectedCloseDate
          ? parseDateOnly(parsed.data.expectedCloseDate)
          : undefined,
        expectedDeliveryWindowStart: parsed.data.expectedDeliveryWindowStart
          ? parseDateOnly(parsed.data.expectedDeliveryWindowStart)
          : undefined,
        expectedDeliveryWindowEnd: parsed.data.expectedDeliveryWindowEnd
          ? parseDateOnly(parsed.data.expectedDeliveryWindowEnd)
          : undefined,
        nextAction: parsed.data.nextAction || undefined,
        productConfig: (parsed.data.productConfig || undefined) as
          | Prisma.InputJsonValue
          | undefined,
        priorOpportunityId: parsed.data.priorOpportunityId || undefined,
        lastQualifyingActivityAt: now,
      },
      include: {
        client: true,
        program: true,
        owner: { select: { id: true, fullName: true } },
      },
    });

    await recordSalesActivity({
      actor: req.user!,
      activityType: 'new_lead',
      summary: `New lead · ${row.client.name} · ${row.program.name}`,
      clientId: row.clientId,
      opportunityId: row.id,
      programId: row.programId,
      productFamily: row.program.programFamily,
      stage: row.stage,
      nextAction: row.nextAction,
    });

    await logActivity({
      actor: req.user!,
      action: ActivityAction.insert,
      tableName: 'opportunities',
      recordId: row.id,
      reason: parsed.data.overrideReason || undefined,
    });

    res.status(201).json(enrichOpportunity(row));
  }),
);

salesRouter.patch(
  '/opportunities/:id',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const opp = await prisma.opportunity.findUnique({
      where: { id },
      include: { program: true, client: true },
    });
    if (!opp) throw new AppError('Not found', 404);
    requireEditAccess(toVisibility(req.user!), opp.ownerPersonId);

    const parsed = opportunityPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);

    const nextStage = parsed.data.stage || opp.stage;
    assertSchoolContacts({
      audience: opp.program.audience,
      decisionMakerContactId:
        parsed.data.decisionMakerContactId ?? opp.decisionMakerContactId,
      coordinatorContactId:
        parsed.data.coordinatorContactId ?? opp.coordinatorContactId,
      stage: nextStage,
    });

    if (nextStage === 'on_hold' && !parsed.data.onHoldReason && !opp.onHoldReason) {
      throw new AppError('On Hold requires a reason', 400);
    }

    const now = serverNow();
    let proposalSentAt = opp.proposalSentAt;
    let proposalStatus = opp.proposalStatus;
    let lastQualifying = opp.lastQualifyingActivityAt;

    if (parsed.data.markProposalSent || parsed.data.proposalStatus === 'sent') {
      proposalSentAt = proposalSentAt || now;
      proposalStatus = parsed.data.proposalStatus || 'sent';
      lastQualifying = now;
    }
    if (parsed.data.proposalStatus === 'revised') {
      proposalStatus = 'revised';
      lastQualifying = now;
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        contactId: parsed.data.contactId === undefined ? undefined : parsed.data.contactId,
        decisionMakerContactId:
          parsed.data.decisionMakerContactId === undefined
            ? undefined
            : parsed.data.decisionMakerContactId,
        coordinatorContactId:
          parsed.data.coordinatorContactId === undefined
            ? undefined
            : parsed.data.coordinatorContactId,
        leadSource: parsed.data.leadSource,
        probability: parsed.data.probability,
        expectedValue: parsed.data.expectedValue,
        quotedValue: parsed.data.quotedValue === undefined ? undefined : parsed.data.quotedValue,
        expectedStudents: parsed.data.expectedStudents === undefined ? undefined : parsed.data.expectedStudents,
        expectedRegistrations:
          parsed.data.expectedRegistrations === undefined
            ? undefined
            : parsed.data.expectedRegistrations,
        expectedCloseDate: parsed.data.expectedCloseDate
          ? parseDateOnly(parsed.data.expectedCloseDate)
          : parsed.data.expectedCloseDate === null
            ? null
            : undefined,
        nextAction: parsed.data.nextAction === undefined ? undefined : parsed.data.nextAction,
        productConfig:
          parsed.data.productConfig === undefined
            ? undefined
            : parsed.data.productConfig === null
              ? Prisma.JsonNull
              : (parsed.data.productConfig as Prisma.InputJsonValue),
        stage: parsed.data.stage as OpportunityStage | undefined,
        proposalAmount:
          parsed.data.proposalAmount === undefined ? undefined : parsed.data.proposalAmount,
        proposalStatus,
        proposalSentAt,
        onHoldReason: parsed.data.onHoldReason === undefined ? undefined : parsed.data.onHoldReason,
        onHoldReopenMonth: parsed.data.onHoldReopenMonth
          ? parseDateOnly(parsed.data.onHoldReopenMonth)
          : undefined,
        lostReason: parsed.data.lostReason === undefined ? undefined : parsed.data.lostReason,
        actualValue: parsed.data.actualValue === undefined ? undefined : parsed.data.actualValue,
        lastQualifyingActivityAt: lastQualifying,
      },
      include: {
        client: true,
        program: true,
        owner: { select: { id: true, fullName: true } },
      },
    });

    if (parsed.data.markProposalSent || parsed.data.proposalStatus === 'sent') {
      await recordSalesActivity({
        actor: req.user!,
        activityType: 'proposal_sent',
        summary: `Proposal sent · ${updated.client.name}`,
        clientId: updated.clientId,
        opportunityId: updated.id,
        programId: updated.programId,
        productFamily: updated.program.programFamily,
        stage: updated.stage,
      });
    }

    if (parsed.data.stage && parsed.data.stage !== opp.stage) {
      await recordSalesActivity({
        actor: req.user!,
        activityType: 'stage_change',
        summary: `Stage ${opp.stage} → ${parsed.data.stage} · ${updated.client.name}`,
        clientId: updated.clientId,
        opportunityId: updated.id,
        programId: updated.programId,
        productFamily: updated.program.programFamily,
        stage: updated.stage,
      });
    }

    res.json(enrichOpportunity(updated));
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
    requireEditAccess(toVisibility(req.user!), opp.ownerPersonId);

    if (stage === 'won' || stage === 'registered') {
      const won = await markWon({
        actor: req.user!,
        opportunityId: opp.id,
        actualValue: req.body.actualValue,
      });
      return res.json(enrichOpportunity(won));
    }

    assertSchoolContacts({
      audience: opp.program.audience,
      decisionMakerContactId: opp.decisionMakerContactId,
      coordinatorContactId: opp.coordinatorContactId,
      stage,
    });

    if (stage === 'on_hold' && !req.body.onHoldReason && !opp.onHoldReason) {
      throw new AppError('On Hold requires a reason and expected reopen month', 400);
    }

    const updated = await prisma.opportunity.update({
      where: { id: opp.id },
      data: {
        stage,
        ...(stage === 'on_hold'
          ? {
              onHoldReason: req.body.onHoldReason || opp.onHoldReason,
              onHoldReopenMonth: req.body.onHoldReopenMonth
                ? parseDateOnly(req.body.onHoldReopenMonth)
                : opp.onHoldReopenMonth,
            }
          : {}),
        ...(stage === 'lost' || stage === 'dead'
          ? { lostReason: req.body.lostReason || opp.lostReason }
          : {}),
        ...(req.body.probability ? { probability: Number(req.body.probability) } : {}),
      },
      include: {
        client: true,
        program: true,
        owner: { select: { id: true, fullName: true } },
      },
    });

    await recordSalesActivity({
      actor: req.user!,
      activityType:
        stage === 'lost' || stage === 'dead'
          ? 'lost'
          : stage === 'on_hold'
            ? 'on_hold'
            : 'stage_change',
      summary: `Stage → ${stage} · ${opp.client.name}`,
      clientId: opp.clientId,
      opportunityId: opp.id,
      programId: opp.programId,
      productFamily: opp.program.programFamily,
      stage,
    });

    res.json(enrichOpportunity(updated));
  }),
);

salesRouter.post(
  '/interactions',
  asyncHandler(async (req, res) => {
    const parsed = interactionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);

    const result = await logInteraction({
      actor: req.user!,
      data: {
        opportunityId: parsed.data.opportunityId,
        contactId: parsed.data.contactId,
        communicationMode: parsed.data.communicationMode,
        interactionType: parsed.data.interactionType,
        outcome: parsed.data.outcome,
        notes: parsed.data.notes,
        nextAction: parsed.data.nextAction,
        nextFollowUpDate: parsed.data.nextFollowUpDate
          ? parseDateOnly(parsed.data.nextFollowUpDate)
          : null,
        stageAfter: parsed.data.stageAfter,
      },
      outstation: !!req.body.outstation,
    });

    if (parsed.data.communicationMode === 'physical_meeting' && req.body.outstation) {
      const today = startOfToday();
      await prisma.dayRecord.upsert({
        where: { personId_date: { personId: req.user!.id, date: today } },
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
      recordId: result.row.id,
    });

    res.status(201).json(result);
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
          stage: { in: ['contacted', 'requirements', 'proposal_sent', 'follow_up', 'interested', 'proposal_shared', 'follow_up_required'] },
        },
      });
      const firm = await prisma.opportunity.count({
        where: {
          expectedDeliveryWindowStart: { lte: date },
          expectedDeliveryWindowEnd: { gte: date },
          stage: { in: ['won', 'registered'] },
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
        stage: { notIn: ['won', 'lost', 'dead', 'completed', 'not_interested', 'registered'] },
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
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    const row = await prisma.contact.create({
      data: {
        clientId: parsed.data.clientId,
        name: parsed.data.name,
        designation: parsed.data.designation || undefined,
        mobile: parsed.data.mobile || undefined,
        email: parsed.data.email || undefined,
        contactRole: parsed.data.contactRole || 'other',
        isPrimary: !!parsed.data.isPrimary,
        notes: parsed.data.notes || undefined,
        createdById: req.user!.id,
      },
    });
    res.status(201).json(row);
  }),
);

salesRouter.get(
  '/feed',
  asyncHandler(async (req, res) => {
    const personId = req.query.personId ? String(req.query.personId) : undefined;
    const product = req.query.product ? String(req.query.product) : undefined;
    const q = req.query.q ? String(req.query.q).trim() : '';
    const from = req.query.from ? parseDateOnly(String(req.query.from)) : undefined;
    const to = req.query.to ? parseDateOnly(String(req.query.to)) : undefined;

    const rows = await prisma.salesActivityEvent.findMany({
      where: {
        ...(personId ? { personId } : {}),
        ...(product ? { productFamily: product } : {}),
        ...(from || to
          ? {
              occurredAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { summary: { contains: q, mode: 'insensitive' } },
                { client: { name: { contains: q, mode: 'insensitive' } } },
                { client: { contactPhone: { contains: q } } },
              ],
            }
          : {}),
      },
      include: {
        person: { select: { id: true, fullName: true } },
        client: { select: { id: true, name: true, city: true, branch: true } },
        program: { select: { id: true, name: true, programFamily: true } },
        opportunity: { select: { id: true, stage: true, nextAction: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 100, 300),
    });
    res.json(rows);
  }),
);

salesRouter.get(
  '/duplicates',
  asyncHandler(async (req, res) => {
    const rows = await findDuplicateClients({
      name: req.query.name ? String(req.query.name) : undefined,
      city: req.query.city ? String(req.query.city) : undefined,
      branch: req.query.branch ? String(req.query.branch) : undefined,
      phone: req.query.phone ? String(req.query.phone) : undefined,
      email: req.query.email ? String(req.query.email) : undefined,
    });
    res.json(rows);
  }),
);

salesRouter.post(
  '/validate-client-name',
  asyncHandler(async (req, res) => {
    res.json(validateClientName(String(req.body.name || ''), String(req.body.clientType || 'school')));
  }),
);

salesRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const scopeAll = req.user!.role === 'owner' || req.user!.role === 'administrator';
    const personId =
      scopeAll && req.query.personId ? String(req.query.personId) : req.user!.id;
    const ownerFilter = scopeAll && !req.query.personId ? {} : { ownerPersonId: personId };

    const now = serverNow();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), quarterMonth, 1));

    const [open, wonMonth, targets, alerts, followUpsDue] = await Promise.all([
      prisma.opportunity.findMany({
        where: {
          ...ownerFilter,
          stage: {
            in: ['lead', 'contacted', 'requirements', 'proposal_sent', 'follow_up', 'on_hold'],
          },
        },
        include: { program: true, client: true },
      }),
      prisma.opportunity.findMany({
        where: {
          ...ownerFilter,
          stage: { in: ['won', 'registered'] },
          updatedAt: { gte: monthStart },
        },
      }),
      prisma.salesTarget.findMany({
        where: {
          personId: scopeAll && !req.query.personId ? undefined : personId,
          month: { gte: monthStart },
        },
      }),
      prisma.opportunity.findMany({
        where: {
          ...ownerFilter,
          stage: {
            in: ['lead', 'contacted', 'requirements', 'proposal_sent', 'follow_up', 'on_hold'],
          },
        },
        include: { program: true, client: true },
        take: 200,
      }),
      prisma.interaction.count({
        where: {
          personId: scopeAll && !req.query.personId ? undefined : personId,
          followUpCompleted: false,
          nextFollowUpDate: { lte: startOfToday() },
        },
      }),
    ]);

    const enrichedOpen = open.map((o) => enrichOpportunity(o));
    const pipeline = enrichedOpen.reduce((s, o) => s + (o.expectedValue || 0), 0);
    const weighted = enrichedOpen.reduce((s, o) => s + (o.weightedValue || 0), 0);
    const achievement = wonMonth.reduce((s, o) => s + (o.actualValue || o.expectedValue || 0), 0);
    const targetValue = targets.reduce((s, t) => s + t.targetValue, 0);
    const commercialAlerts = enrichedOpen.flatMap((o) =>
      (o.commercialAlerts || []).map((a) => ({
        opportunityId: o.id,
        client: o.client?.name,
        ...a,
      })),
    );
    const ageingWarnings = enrichedOpen.filter((o) => o.ageing?.warning || o.ageing?.dead);

    res.json({
      period: { monthStart, quarterStart },
      target: targetValue,
      achievement,
      balance: Math.max(0, targetValue - achievement),
      achievementPct: targetValue ? Math.round((achievement / targetValue) * 100) : null,
      pipeline,
      weightedPipeline: weighted,
      projectedAchievement: achievement + weighted,
      openCount: enrichedOpen.length,
      followUpsDue,
      commercialAlerts,
      ageingWarnings: ageingWarnings.map((o) => ({
        id: o.id,
        client: o.client?.name,
        days: o.ageing?.days,
        dead: o.ageing?.dead,
      })),
      byProduct: Object.values(
        enrichedOpen.reduce<Record<string, { family: string; value: number; count: number }>>(
          (acc, o) => {
            const family = o.program?.programFamily || 'other';
            acc[family] = acc[family] || { family, value: 0, count: 0 };
            acc[family].value += o.expectedValue || 0;
            acc[family].count += 1;
            return acc;
          },
          {},
        ),
      ),
      schoolVsRetail: {
        school: enrichedOpen.filter((o) => o.program?.audience === 'school').length,
        retail: enrichedOpen.filter((o) => o.program?.audience === 'retail_direct_parent').length,
      },
    });
  }),
);

salesRouter.get(
  '/rules',
  asyncHandler(async (_req, res) => {
    res.json({
      rules: CRM_RULES_COPY,
      defaults: CRM_DEFAULTS,
    });
  }),
);

salesRouter.post(
  '/ageing/sweep',
  requireApprover,
  asyncHandler(async (_req, res) => {
    const marked = await applyAgeingSweep();
    res.json({ marked });
  }),
);

salesRouter.get(
  '/unavailability',
  asyncHandler(async (req, res) => {
    const scopeAll = req.user!.role === 'owner' || req.user!.role === 'administrator';
    const rows = await prisma.unavailabilityRequest.findMany({
      where: scopeAll && req.query.scope === 'all' ? {} : { personId: req.user!.id },
      include: {
        person: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  }),
);

salesRouter.post(
  '/unavailability',
  asyncHandler(async (req, res) => {
    const parsed = salesUnavailabilitySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    const start = new Date(parsed.data.startDateTime);
    const end = new Date(parsed.data.endDateTime);
    if (!(start < end)) throw new AppError('End must be after start');
    if (start < serverNow() && req.user!.role !== 'owner') {
      throw new AppError('Past-period leave requires Owner intervention', 400);
    }

    const row = await prisma.unavailabilityRequest.create({
      data: {
        personId: req.user!.id,
        fromDate: parseDateOnly(start.toISOString().slice(0, 10)),
        toDate: parseDateOnly(end.toISOString().slice(0, 10)),
        startDateTime: start,
        endDateTime: end,
        reason: parsed.data.reason,
      },
    });

    const owners = await prisma.person.findMany({
      where: { role: 'owner', isActive: true },
      select: { id: true },
    });
    for (const o of owners) {
      await notify({
        recipientPersonId: o.id,
        category: 'sales_leave',
        title: 'Sales leave/unavailability request',
        body: `${req.user!.fullName}: ${parsed.data.reason}`,
        linkedRecordId: row.id,
        linkedRecordType: 'unavailability_request',
        priority: 'action_required',
        deepLink: '/sales/leave',
      });
    }

    res.status(201).json(row);
  }),
);

salesRouter.post(
  '/unavailability/:id/review',
  requireApprover,
  asyncHandler(async (req, res) => {
    const status = req.body.status === 'approved' ? 'approved' : 'rejected';
    const row = await prisma.unavailabilityRequest.update({
      where: { id: param(req, 'id') },
      data: {
        status,
        reviewedById: req.user!.id,
        reviewedAt: serverNow(),
        reviewerComment: req.body.comment || undefined,
      },
    });
    await notify({
      recipientPersonId: row.personId,
      category: 'sales_leave',
      title: `Leave request ${status}`,
      body: req.body.comment || '',
      linkedRecordId: row.id,
      priority: 'action_required',
    });
    res.json(row);
  }),
);

salesRouter.post(
  '/nil-report',
  asyncHandler(async (req, res) => {
    const parsed = nilReportSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);
    const date = parseDateOnly(parsed.data.date);
    const row = await prisma.nilReport.upsert({
      where: { personId_date: { personId: req.user!.id, date } },
      update: { reason: parsed.data.reason },
      create: { personId: req.user!.id, date, reason: parsed.data.reason },
    });
    await recordSalesActivity({
      actor: req.user!,
      activityType: 'nil_report',
      summary: `Nil report · ${parsed.data.reason.slice(0, 80)}`,
      metadata: { date: parsed.data.date },
    });
    res.status(201).json(row);
  }),
);
