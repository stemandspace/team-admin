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
  'sales_activity_events',
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

/**
 * Release 1: shared sales visibility — all salespeople can SEE opportunities.
 * Editing / closing / reassigning remains owner-only for others' records.
 */
export function canSeeOpportunity(
  user: VisibilitySubject,
  _ownerPersonId: string,
): boolean {
  return canAccessCommercialData(user);
}

/** Only owner of the record (or Owner role) may mutate commercial records */
export function canEditOpportunity(
  user: VisibilitySubject,
  ownerPersonId: string,
): boolean {
  if (!canAccessCommercialData(user)) return false;
  if (user.role === 'owner') return true;
  if (user.role === 'administrator') return true; // reserved; Release 1 may disable later
  return user.id === ownerPersonId;
}

export function isSalesOwner(user: VisibilitySubject): boolean {
  return user.role === 'owner';
}
