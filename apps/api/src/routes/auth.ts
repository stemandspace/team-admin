import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, ActivityAction } from '@team-admin/db';
import { loginSchema } from '@team-admin/shared';
import { asyncHandler, AppError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { logActivity } from '../services/common';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.message);

    const person = await prisma.person.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (!person || !person.isActive) {
      await logActivity({
        action: ActivityAction.login_failed,
        newValue: { email: parsed.data.email },
        ipAddress: req.ip,
      });
      throw new AppError('Invalid credentials', 401);
    }

    const ok = await bcrypt.compare(parsed.data.password, person.passwordHash);
    if (!ok) {
      await logActivity({
        action: ActivityAction.login_failed,
        affectedPersonId: person.id,
        ipAddress: req.ip,
      });
      throw new AppError('Invalid credentials', 401);
    }

    const secret = process.env.JWT_SECRET || 'dev-secret';
    const token = jwt.sign(
      { sub: person.id, email: person.email },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] },
    );

    await logActivity({
      actor: {
        id: person.id,
        email: person.email,
        fullName: person.fullName,
        role: person.role,
        team: person.team,
        employeeCode: person.employeeCode,
      },
      action: ActivityAction.login_success,
      ipAddress: req.ip,
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      user: {
        id: person.id,
        email: person.email,
        fullName: person.fullName,
        role: person.role,
        team: person.team,
        employeeCode: person.employeeCode,
        baseCity: person.baseCity,
      },
    });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    await logActivity({
      actor: req.user!,
      action: ActivityAction.logout,
    });
    res.clearCookie('token');
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const person = await prisma.person.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        team: true,
        employeeCode: true,
        baseCity: true,
        phone: true,
        dateOfJoining: true,
        isActive: true,
        reportsToId: true,
      },
    });
    res.json(person);
  }),
);
