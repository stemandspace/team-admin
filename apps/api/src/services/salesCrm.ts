import {
  prisma,
  ActivityAction,
  OpportunityStage,
  SalesActivityType,
  Prisma,
} from '@team-admin/db';
import {
  ageingStatus,
  canEditOpportunity,
  computeWorkshopAlerts,
  isCompletedInteraction,
  isOpenStage,
  isQualifyingInteraction,
  looksAbbreviatedSchoolName,
  normalizeSchoolName,
  ownershipDaysForWin,
  addDays,
  type VisibilitySubject,
  type WorkshopProductConfig,
} from '@team-admin/shared';
import { AppError } from '../middleware/error';
import { logActivity, notify, serverNow } from './common';

type Actor = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  team: string;
};

export async function recordSalesActivity(input: {
  actor: Actor;
  activityType: SalesActivityType;
  summary: string;
  clientId?: string | null;
  opportunityId?: string | null;
  programId?: string | null;
  channel?: string | null;
  productFamily?: string | null;
  stage?: OpportunityStage | null;
  nextAction?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.salesActivityEvent.create({
    data: {
      personId: input.actor.id,
      activityType: input.activityType,
      summary: input.summary,
      clientId: input.clientId || undefined,
      opportunityId: input.opportunityId || undefined,
      programId: input.programId || undefined,
      channel: input.channel || undefined,
      productFamily: input.productFamily || undefined,
      stage: input.stage || undefined,
      nextAction: input.nextAction || undefined,
      metadata: input.metadata,
      occurredAt: serverNow(),
    },
  });
}

export async function findDuplicateClients(input: {
  name?: string;
  city?: string;
  branch?: string | null;
  phone?: string | null;
  email?: string | null;
  clientType?: string;
}) {
  const where: Prisma.ClientWhereInput[] = [];
  if (input.name && input.city) {
    where.push({
      AND: [
        { name: { contains: normalizeSchoolName(input.name).split(' ')[0], mode: 'insensitive' } },
        { city: { equals: input.city, mode: 'insensitive' } },
        ...(input.branch
          ? [{ branch: { equals: input.branch, mode: 'insensitive' as const } }]
          : []),
      ],
    });
  }
  if (input.phone) {
    where.push({ contactPhone: { contains: input.phone.replace(/\D/g, '').slice(-10) } });
  }
  if (input.email) {
    where.push({ contactEmail: { equals: input.email, mode: 'insensitive' } });
  }
  if (!where.length) return [];
  return prisma.client.findMany({
    where: { OR: where },
    include: {
      opportunities: {
        where: { stage: { in: OPEN_STAGES_DB } },
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          program: true,
        },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      },
      ownerships: {
        where: { isActive: true, expiresAt: { gt: serverNow() } },
        include: { owner: { select: { id: true, fullName: true } } },
      },
    },
    take: 10,
  });
}

const OPEN_STAGES_DB = [
  'lead',
  'contacted',
  'requirements',
  'proposal_sent',
  'follow_up',
  'on_hold',
  'exploratory',
  'interested',
  'proposal_shared',
  'follow_up_required',
] as OpportunityStage[];

export async function assertCanCreateOpportunity(input: {
  actor: Actor;
  clientId: string;
  programId: string;
  overrideConflict?: boolean;
  overrideReason?: string | null;
}) {
  const open = await prisma.opportunity.findMany({
    where: {
      clientId: input.clientId,
      programId: input.programId,
      stage: { in: OPEN_STAGES_DB },
    },
    include: {
      owner: { select: { id: true, fullName: true } },
      program: true,
      client: true,
    },
  });

  const competing = open.filter((o) => o.ownerPersonId !== input.actor.id);
  if (competing.length && !input.overrideConflict) {
    throw new AppError(
      `Open opportunity already owned by ${competing[0].owner.fullName}. View their activity instead, or ask Owner to override.`,
      409,
    );
  }

  if (competing.length && input.overrideConflict) {
    if (input.actor.role !== 'owner') {
      throw new AppError('Only Owner can override ownership conflicts', 403);
    }
    if (!input.overrideReason?.trim()) {
      throw new AppError('Override reason is required', 400);
    }
  }

  const ownership = await prisma.relationshipOwnership.findFirst({
    where: {
      clientId: input.clientId,
      isActive: true,
      expiresAt: { gt: serverNow() },
      ownerPersonId: { not: input.actor.id },
    },
    include: { owner: { select: { fullName: true } } },
  });

  if (ownership && !input.overrideConflict) {
    throw new AppError(
      `Active relationship ownership held by ${ownership.owner.fullName} until ${ownership.expiresAt.toISOString().slice(0, 10)}.`,
      409,
    );
  }

  return { competing, ownership };
}

export function assertSchoolContacts(input: {
  audience: string;
  decisionMakerContactId?: string | null;
  coordinatorContactId?: string | null;
  stage: string;
}) {
  if (input.audience !== 'school') return;
  const needsContacts = !['lead'].includes(input.stage);
  if (!needsContacts) return;
  if (!input.decisionMakerContactId || !input.coordinatorContactId) {
    throw new AppError(
      'School opportunities require Decision Maker and Coordinator contacts before advancing.',
      400,
    );
  }
}

export function requireEditAccess(user: VisibilitySubject, ownerPersonId: string) {
  if (!canEditOpportunity(user, ownerPersonId)) {
    throw new AppError(
      'You can view this opportunity but only the owning salesperson (or Owner) can edit it.',
      403,
    );
  }
}

export async function applyAgeingSweep() {
  const open = await prisma.opportunity.findMany({
    where: { stage: { in: OPEN_STAGES_DB } },
  });
  const now = serverNow();
  let marked = 0;
  for (const opp of open) {
    const anchor = opp.lastQualifyingActivityAt || opp.createdAt;
    const status = ageingStatus(anchor, now);
    if (status.dead) {
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { stage: 'dead', dormantSince: now, lostReason: 'No qualifying commercial movement for 60 days' },
      });
      marked += 1;
    } else if (status.warning) {
      await notify({
        recipientPersonId: opp.ownerPersonId,
        category: 'sales',
        title: 'Opportunity nearing 60-day death',
        body: `Opportunity has ${status.days} days without qualifying activity.`,
        priority: 'urgent',
        deepLink: `/sales?opportunity=${opp.id}`,
        linkedRecordId: opp.id,
        linkedRecordType: 'opportunity',
      });
    }
  }
  return marked;
}

export function enrichOpportunity<T extends {
  expectedValue: number;
  probability?: number | null;
  expectedStudents?: number | null;
  productConfig?: unknown;
  program?: { audience?: string; programFamily?: string } | null;
  lastQualifyingActivityAt?: Date | null;
  createdAt: Date;
  stage: string;
}>(opp: T) {
  const probability = opp.probability ?? 25;
  const cfg = (opp.productConfig || {}) as WorkshopProductConfig;
  const alerts =
    opp.program?.programFamily === 'workshop'
      ? computeWorkshopAlerts({
          audience: opp.program.audience || 'school',
          expectedStudents: opp.expectedStudents,
          expectedValue: opp.expectedValue,
          productConfig: cfg,
        })
      : [];
  const ageing = ageingStatus(opp.lastQualifyingActivityAt || opp.createdAt);
  return {
    ...opp,
    weightedValue: (opp.expectedValue || 0) * (probability / 100),
    commercialAlerts: alerts,
    ageing,
    isOpen: isOpenStage(opp.stage),
  };
}

export async function markWon(input: {
  actor: Actor;
  opportunityId: string;
  actualValue?: number | null;
}) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: input.opportunityId },
    include: { client: true, program: true },
  });
  if (!opp) throw new AppError('Opportunity not found', 404);
  requireEditAccess(
    { id: input.actor.id, role: input.actor.role as never, team: input.actor.team as never },
    opp.ownerPersonId,
  );

  const actual = input.actualValue ?? opp.quotedValue ?? opp.expectedValue;
  const now = serverNow();
  const days = ownershipDaysForWin({
    programFamily: opp.program.programFamily,
    audience: opp.program.audience,
    actualValue: actual,
  });

  let linkedEngagementId = opp.linkedEngagementId;
  if (!linkedEngagementId) {
    const engagement = await prisma.engagement.create({
      data: {
        clientId: opp.clientId,
        title: `${opp.client.name} — ${opp.program.name}`,
        programId: opp.programId,
        expectedStudents: opp.expectedStudents || undefined,
        expectedValue: actual,
        totalRevenueCollected: actual,
        status: 'won',
      },
    });
    linkedEngagementId = engagement.id;
  }

  const updated = await prisma.opportunity.update({
    where: { id: opp.id },
    data: {
      stage: 'won',
      actualValue: actual,
      linkedEngagementId,
      creditedPersonId: opp.creditedPersonId || opp.ownerPersonId,
      ownershipExpiresAt: addDays(now, days),
      lastQualifyingActivityAt: now,
    },
    include: { client: true, program: true, owner: { select: { id: true, fullName: true } } },
  });

  await prisma.relationshipOwnership.updateMany({
    where: { clientId: opp.clientId, isActive: true },
    data: { isActive: false },
  });
  await prisma.relationshipOwnership.create({
    data: {
      clientId: opp.clientId,
      ownerPersonId: opp.ownerPersonId,
      programFamily: opp.program.programFamily,
      expiresAt: addDays(now, days),
      lastQualifyingAt: now,
      isActive: true,
    },
  });

  if (opp.client.isNewSchool) {
    await prisma.client.update({
      where: { id: opp.clientId },
      data: { isNewSchool: false, firstWonAt: now, lifecycleStatus: 'active_client' },
    });
  }

  await recordSalesActivity({
    actor: input.actor,
    activityType: 'won',
    summary: `Won ${opp.program.name} for ${opp.client.name} (₹${actual})`,
    clientId: opp.clientId,
    opportunityId: opp.id,
    programId: opp.programId,
    productFamily: opp.program.programFamily,
    stage: 'won',
  });

  await logActivity({
    actor: input.actor as never,
    action: ActivityAction.update,
    tableName: 'opportunities',
    recordId: opp.id,
    newValue: { stage: 'won', actualValue: actual },
  });

  return updated;
}

export async function logInteraction(input: {
  actor: Actor;
  data: {
    opportunityId: string;
    contactId?: string | null;
    communicationMode: string;
    interactionType: string;
    outcome: string;
    notes: string;
    nextAction?: string | null;
    nextFollowUpDate?: Date | null;
    stageAfter?: string | null;
  };
  outstation?: boolean;
}) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: input.data.opportunityId },
    include: { program: true, client: true },
  });
  if (!opp) throw new AppError('Opportunity not found', 404);
  requireEditAccess(
    { id: input.actor.id, role: input.actor.role as never, team: input.actor.team as never },
    opp.ownerPersonId,
  );

  const completed = isCompletedInteraction(input.data.outcome);
  const qualifying =
    completed && isQualifyingInteraction(input.data.interactionType, input.data.outcome);
  const now = serverNow();

  const row = await prisma.interaction.create({
    data: {
      opportunityId: opp.id,
      contactId: input.data.contactId || undefined,
      personId: input.actor.id,
      communicationMode: input.data.communicationMode as never,
      interactionType: input.data.interactionType as never,
      outcome: input.data.outcome as never,
      notes: input.data.notes,
      nextAction: input.data.nextAction || undefined,
      isQualifying: qualifying,
      stageBefore: opp.stage,
      stageAfter: (input.data.stageAfter as OpportunityStage) || undefined,
      nextFollowUpDate: input.data.nextFollowUpDate || undefined,
      occurredAt: now,
      loggedAt: now,
      isLocked: true,
    },
  });

  const stageAfter = input.data.stageAfter as OpportunityStage | undefined;
  await prisma.opportunity.update({
    where: { id: opp.id },
    data: {
      lastInteractionAt: now,
      dormantSince: null,
      ...(qualifying ? { lastQualifyingActivityAt: now } : {}),
      ...(input.data.nextAction ? { nextAction: input.data.nextAction } : {}),
      ...(stageAfter ? { stage: stageAfter } : {}),
    },
  });

  if (completed) {
    await recordSalesActivity({
      actor: input.actor,
      activityType: qualifying ? 'conversation' : 'follow_up',
      summary: `${input.data.interactionType.replace(/_/g, ' ')} · ${opp.client.name}`,
      clientId: opp.clientId,
      opportunityId: opp.id,
      programId: opp.programId,
      channel: input.data.communicationMode,
      productFamily: opp.program.programFamily,
      stage: stageAfter || opp.stage,
      nextAction: input.data.nextAction,
    });
  }

  return { row, qualifying, completed };
}

export function validateClientName(name: string, clientType: string) {
  if (clientType === 'school' && looksAbbreviatedSchoolName(name)) {
    return {
      warning:
        'Prefer the full official school name (e.g. Delhi Public School) instead of abbreviations.',
      normalized: normalizeSchoolName(name),
    };
  }
  return { warning: null as string | null, normalized: name.trim() };
}
