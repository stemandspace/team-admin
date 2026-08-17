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

/** Canonical CRM stages (Release 1) */
export const OPPORTUNITY_STAGES = [
  'lead',
  'contacted',
  'requirements',
  'proposal_sent',
  'follow_up',
  'won',
  'on_hold',
  'lost',
  'dead',
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPEN_OPPORTUNITY_STAGES: OpportunityStage[] = [
  'lead',
  'contacted',
  'requirements',
  'proposal_sent',
  'follow_up',
  'on_hold',
];

export const PROBABILITIES = [25, 50, 75, 100] as const;
export type Probability = (typeof PROBABILITIES)[number];

export const LEAD_SOURCES = ['inbound', 'outbound'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const PROPOSAL_STATUSES = [
  'not_sent',
  'sent',
  'revised',
  'accepted',
  'rejected',
  'negotiated',
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const CONTACT_ROLES = ['decision_maker', 'coordinator', 'other'] as const;
export type ContactRoleType = (typeof CONTACT_ROLES)[number];

export const CLIENT_TYPES = ['school', 'community', 'retail', 'corporate'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const LIFECYCLE_STATUSES = ['prospect', 'active_client', 'dormant', 'lost'] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const PROGRAM_FAMILIES = [
  'workshop',
  'iasc',
  'nac',
  'explorium',
  'project',
  'olympiad',
  'challenge',
  'other',
] as const;
export type ProgramFamily = (typeof PROGRAM_FAMILIES)[number];

export const AUDIENCES = ['school', 'retail_direct_parent'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const COMMUNICATION_MODES = [
  'phone',
  'whatsapp',
  'whatsapp_call',
  'email',
  'zoom',
  'physical_meeting',
] as const;

export const INTERACTION_TYPES = [
  'first_contact',
  'follow_up',
  'proposal_discussion',
  'registration_discussion',
  'requirement_discussion',
  'commercial_discussion',
  'negotiation',
  'client_decision',
] as const;

export const INTERACTION_OUTCOMES = [
  'connected',
  'no_answer',
  'dead_connect',
  'positive',
  'neutral',
  'negative',
  'callback_requested',
  'cancelled_meeting',
] as const;

/** Outcomes that do NOT count as completed interactions */
export const NON_COMPLETED_OUTCOMES = [
  'no_answer',
  'dead_connect',
  'cancelled_meeting',
] as const;

/** Interaction types that reset the 60-day ageing clock */
export const QUALIFYING_INTERACTION_TYPES = [
  'requirement_discussion',
  'commercial_discussion',
  'proposal_discussion',
  'negotiation',
  'client_decision',
  'registration_discussion',
] as const;

export const GRADE_CLUSTERS = [
  { id: 'junior', label: 'Junior (Grades 2–3)', grades: ['2', '3'] },
  { id: 'middle', label: 'Middle (Grades 4–6)', grades: ['4', '5', '6'] },
  { id: 'senior', label: 'Senior (Grades 7–9)', grades: ['7', '8', '9'] },
] as const;

export const WORKSHOP_DURATIONS = [60, 90] as const;
export const WORKSHOP_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;

/** Commercial alert thresholds (INR) — configurable via policy */
export const CRM_DEFAULTS = {
  schoolWorkshopMinStudents: 150,
  onlineMinPerStudent: 550,
  offlineMinPerStudent: 700,
  iascPricePerRegistration: 2000,
  nacSchoolPrice: 300,
  nacDirectPrice: 500,
  exploriumSingleBook: 499,
  exploriumThreePack: 999,
  ageingDeadDays: 60,
  ageingWarningDays: 45,
  retailOwnershipDays: 90,
  workshopOwnershipDays: 365,
  iascOwnershipDays: 180,
  nacOwnershipDaysLow: 180,
  nacOwnershipDaysHigh: 365,
  nacOwnershipThreshold: 50000,
  inactiveLeadOwnershipDays: 60,
} as const;
