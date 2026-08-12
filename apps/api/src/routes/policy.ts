import { Router } from 'express';
import { prisma, ActivityAction } from '@team-admin/db';
import { policyRuleUpdateSchema } from '@team-admin/shared';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth, requireRole, requireOwner } from '../middleware/auth';
import { logActivity } from '../services/common';
import { param } from '../utils/params';

export const policyRouter = Router();
policyRouter.use(requireAuth);

policyRouter.get(
  '/rules',
  asyncHandler(async (_req, res) => {
    const rules = await prisma.policyRule.findMany({
      orderBy: [{ ruleKey: 'asc' }, { effectiveFrom: 'desc' }],
    });
    // Collapse to latest per key
    const latest = new Map<string, (typeof rules)[0]>();
    for (const r of rules) {
      if (!latest.has(r.ruleKey)) latest.set(r.ruleKey, r);
    }
    res.json([...latest.values()]);
  }),
);

policyRouter.post(
  '/rules/:key',
  requireRole('administrator', 'owner'),
  asyncHandler(async (req, res) => {
    const parsed = policyRuleUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);

    if (param(req, 'key').startsWith('credit_weight') && req.user!.role !== 'owner') {
      throw new AppError('Credit weight matrix is owner-only', 403);
    }

    const old = await prisma.policyRule.findFirst({
      where: { ruleKey: param(req, 'key') },
      orderBy: { effectiveFrom: 'desc' },
    });

    const row = await prisma.policyRule.create({
      data: {
        ruleKey: param(req, 'key'),
        ruleValue: parsed.data.ruleValue,
        description: parsed.data.description || old?.description,
        effectiveFrom: parsed.data.effectiveFrom
          ? new Date(parsed.data.effectiveFrom)
          : new Date(),
      },
    });

    await logActivity({
      actor: req.user!,
      action: ActivityAction.config_change,
      tableName: 'policy_rules',
      recordId: row.id,
      oldValue: old ? { ruleValue: old.ruleValue } : undefined,
      newValue: { ruleValue: row.ruleValue },
    });

    res.status(201).json(row);
  }),
);

policyRouter.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const docs = await prisma.policyDocument.findMany({
      where: {
        OR: [
          { visibilityTeams: { has: req.user!.team } },
          { visibilityTeams: { isEmpty: true } },
        ],
      },
      include: {
        acknowledgements: { where: { personId: req.user!.id } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    res.json(docs);
  }),
);

policyRouter.post(
  '/documents',
  requireRole('administrator', 'owner'),
  asyncHandler(async (req, res) => {
    const doc = await prisma.policyDocument.create({
      data: {
        title: req.body.title,
        bodyOrUrl: req.body.bodyOrUrl,
        version: req.body.version || 1,
        visibilityTeams: req.body.visibilityTeams || [],
        requiresAcknowledgement: !!req.body.requiresAcknowledgement,
      },
    });
    res.status(201).json(doc);
  }),
);

policyRouter.post(
  '/documents/:id/acknowledge',
  asyncHandler(async (req, res) => {
    const ack = await prisma.policyAcknowledgement.upsert({
      where: {
        documentId_personId: {
          documentId: param(req, 'id'),
          personId: req.user!.id,
        },
      },
      update: { comment: req.body.comment },
      create: {
        documentId: param(req, 'id'),
        personId: req.user!.id,
        comment: req.body.comment,
      },
    });
    res.json(ack);
  }),
);

policyRouter.get(
  '/role-agreements/mine',
  asyncHandler(async (req, res) => {
    const rows = await prisma.roleAgreement.findMany({
      where: { personId: req.user!.id },
      orderBy: { version: 'desc' },
    });
    res.json(rows);
  }),
);

policyRouter.post(
  '/role-agreements',
  requireRole('administrator', 'owner'),
  asyncHandler(async (req, res) => {
    const last = await prisma.roleAgreement.findFirst({
      where: { personId: req.body.personId },
      orderBy: { version: 'desc' },
    });
    const row = await prisma.roleAgreement.create({
      data: {
        personId: req.body.personId,
        version: (last?.version || 0) + 1,
        primaryRole: req.body.primaryRole,
        secondaryRole: req.body.secondaryRole,
        modulesQualified: req.body.modulesQualified || [],
        gradeBands: req.body.gradeBands || [],
        capsJson: req.body.capsJson,
        targetsJson: req.body.targetsJson,
        status: 'draft',
        effectiveFrom: new Date(req.body.effectiveFrom || Date.now()),
        approvedById: req.user!.id,
      },
    });
    res.status(201).json(row);
  }),
);

policyRouter.post(
  '/role-agreements/:id/acknowledge',
  asyncHandler(async (req, res) => {
    const row = await prisma.roleAgreement.findUnique({ where: { id: param(req, 'id') } });
    if (!row || row.personId !== req.user!.id) throw new AppError('Not found', 404);
    const updated = await prisma.roleAgreement.update({
      where: { id: row.id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgeComment: req.body.comment,
      },
    });
    res.json(updated);
  }),
);

// Owner-only salary
policyRouter.get(
  '/salary',
  requireOwner,
  asyncHandler(async (_req, res) => {
    res.json(await prisma.salaryDetail.findMany({ include: { person: { select: { fullName: true, employeeCode: true } } } }));
  }),
);
