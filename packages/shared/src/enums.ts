export const TEAMS = ['sales', 'academic', 'support'] as const;
export type Team = (typeof TEAMS)[number];

export const ROLES = ['employee', 'administrator', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const DAY_STATUSES = [
  'present_office',
  'present_wfh',
  'official_travel',
  'workshop_delivery',
  'leave_full',
  'leave_half',
  'comp_off_taken',
  'rest_half_day',
  'holiday',
  'weekly_off',
  'absent',
] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

export const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const WORKSHOP_CATEGORIES = [
  'school_paid',
  'community_paid',
  'retail_paid',
  'corporate_paid',
  'csr_free',
  'demo_free',
  'youtube_open',
  'spacetopia_open',
  'internal_training',
] as const;
export type WorkshopCategory = (typeof WORKSHOP_CATEGORIES)[number];

export const PAID_WORKSHOP_CATEGORIES: WorkshopCategory[] = [
  'school_paid',
  'community_paid',
  'retail_paid',
  'corporate_paid',
];

export const ASSIGNMENT_ROLES = [
  'primary_educator',
  'secondary_educator',
  'primary_support',
  'secondary_support',
  'trainee',
  'observer',
] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export const OPPORTUNITY_STAGES = [
  'exploratory',
  'interested',
  'proposal_shared',
  'follow_up_required',
  'registered',
  'completed',
  'not_interested',
  'lost',
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const CLIENT_TYPES = ['school', 'community', 'retail', 'corporate'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const LIFECYCLE_STATUSES = ['prospect', 'active_client', 'dormant', 'lost'] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
