import type { Role, Team } from './enums';

export type VisibilitySubject = {
  id: string;
  role: Role;
  team: Team;
};

/** Commercial tables academic/support must never SELECT */
export const COMMERCIAL_RESOURCES = [
  'opportunities',
  'interactions',
  'contacts',
  'sales_targets',
] as const;

export function canAccessCommercialData(user: VisibilitySubject): boolean {
  if (user.role === 'administrator' || user.role === 'owner') return true;
  return user.team === 'sales';
}

export function canSeeAllEmployees(user: VisibilitySubject): boolean {
  return user.role === 'administrator' || user.role === 'owner';
}

export function canApprove(user: VisibilitySubject): boolean {
  return user.role === 'administrator' || user.role === 'owner';
}

export function canSeeOwnerFinancials(user: VisibilitySubject): boolean {
  return user.role === 'owner';
}

export function canSeeActivityLog(user: VisibilitySubject): boolean {
  return user.role === 'owner';
}

export function canManageUsers(user: VisibilitySubject): boolean {
  return user.role === 'administrator' || user.role === 'owner';
}

export function canEditPolicyRules(user: VisibilitySubject): boolean {
  return user.role === 'administrator' || user.role === 'owner';
}

export function canOverrideApprovals(user: VisibilitySubject): boolean {
  return user.role === 'owner';
}

export function ownsRecord(user: VisibilitySubject, personId: string): boolean {
  return user.id === personId;
}

/** Sales employee sees own pipeline only; admin/owner see all */
export function canSeeOpportunity(
  user: VisibilitySubject,
  ownerPersonId: string,
): boolean {
  if (!canAccessCommercialData(user)) return false;
  if (user.role === 'administrator' || user.role === 'owner') return true;
  return user.id === ownerPersonId;
}
