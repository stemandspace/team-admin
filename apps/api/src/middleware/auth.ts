import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma, Role, Team } from '@team-admin/db';
import {
  canAccessCommercialData,
  canApprove,
  canSeeActivityLog,
  canSeeOwnerFinancials,
  type Role as SharedRole,
  type Team as SharedTeam,
} from '@team-admin/shared';
import { AppError } from './error';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  team: Team;
  employeeCode: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type JwtPayload = { sub: string; email: string };

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer || req.cookies?.token;
    if (!token) throw new AppError('Unauthorized', 401);

    const secret = process.env.JWT_SECRET || 'dev-secret';
    const decoded = jwt.verify(token, secret) as JwtPayload;
    const person = await prisma.person.findUnique({ where: { id: decoded.sub } });
    if (!person || !person.isActive) throw new AppError('Unauthorized', 401);

    req.user = {
      id: person.id,
      email: person.email,
      fullName: person.fullName,
      role: person.role,
      team: person.team,
      employeeCode: person.employeeCode,
    };
    next();
  } catch {
    next(new AppError('Unauthorized', 401));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden', 403));
    }
    next();
  };
}

export function requireCommercialAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) return next(new AppError('Unauthorized', 401));
  const ok = canAccessCommercialData({
    id: req.user.id,
    role: req.user.role as SharedRole,
    team: req.user.team as SharedTeam,
  });
  if (!ok) return next(new AppError('Commercial data not available for your team', 403));
  next();
}

export function requireApprover(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) return next(new AppError('Unauthorized', 401));
  if (
    !canApprove({
      id: req.user.id,
      role: req.user.role as SharedRole,
      team: req.user.team as SharedTeam,
    })
  ) {
    return next(new AppError('Forbidden', 403));
  }
  next();
}

export function requireOwner(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) return next(new AppError('Unauthorized', 401));
  if (req.user.role !== 'owner') return next(new AppError('Owner only', 403));
  next();
}

export function requireOwnerFinancials(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) return next(new AppError('Unauthorized', 401));
  if (
    !canSeeOwnerFinancials({
      id: req.user.id,
      role: req.user.role as SharedRole,
      team: req.user.team as SharedTeam,
    })
  ) {
    return next(new AppError('Forbidden', 403));
  }
  next();
}

export function requireActivityLogAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) return next(new AppError('Unauthorized', 401));
  if (
    !canSeeActivityLog({
      id: req.user.id,
      role: req.user.role as SharedRole,
      team: req.user.team as SharedTeam,
    })
  ) {
    return next(new AppError('Forbidden', 403));
  }
  next();
}

export function toVisibility(user: AuthUser) {
  return {
    id: user.id,
    role: user.role as SharedRole,
    team: user.team as SharedTeam,
  };
}
