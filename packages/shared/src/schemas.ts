import { z } from 'zod';
import {
  ASSIGNMENT_ROLES,
  AUDIENCES,
  CLIENT_TYPES,
  COMMUNICATION_MODES,
  CONTACT_ROLES,
  INTERACTION_OUTCOMES,
  INTERACTION_TYPES,
  LEAD_SOURCES,
  LEAVE_TYPES,
  OPPORTUNITY_STAGES,
  PROBABILITIES,
  PROGRAM_FAMILIES,
  PROPOSAL_STATUSES,
  ROLES,
  TEAMS,
  WORKSHOP_CATEGORIES,
} from './enums';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createPersonSchema = z.object({
  fullName: z.string().min(2),
  employeeCode: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  team: z.enum(TEAMS),
  role: z.enum(ROLES).default('employee'),
  baseCity: z.string().min(1),
  reportsToId: z.string().uuid().optional().nullable(),
  dateOfJoining: z.string(),
  password: z.string().min(6),
});

export const leaveRequestSchema = z.object({
  fromDate: z.string(),
  toDate: z.string(),
  leaveType: z.enum(LEAVE_TYPES),
  isHalfDay: z.boolean().default(false),
  reason: z.string().min(5),
  substitutePersonId: z.string().uuid().optional().nullable(),
});

export const punchSchema = z.object({
  workLocation: z.enum(['office', 'home', 'client_site', 'travel']),
  punchInLat: z.number().optional().nullable(),
  punchInLng: z.number().optional().nullable(),
  lateReason: z.string().optional().nullable(),
});

export const workshopCreateSchema = z.object({
  engagementId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  title: z.string().min(2),
  moduleDelivered: z.string().optional().nullable(),
  workshopCategory: z.enum(WORKSHOP_CATEGORIES),
  revenueType: z
    .enum(['client_billed', 'ticketed', 'sponsored', 'free_outreach', 'platform_hosted'])
    .default('client_billed'),
  mode: z.enum(['offline', 'online']),
  platform: z
    .enum(['none', 'spacetopia', 'youtube', 'zoom', 'google_meet'])
    .default('none'),
  locationType: z.enum(['within_city', 'outstation']).optional().nullable(),
  city: z.string().min(1),
  scheduledDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  sessionsCount: z.number().int().positive().default(1),
  sessionStructure: z.enum(['sequential', 'parallel']).default('sequential'),
  batchesPerDay: z.number().int().positive().default(1),
  venue: z.string().optional().nullable(),
  reportingTime: z.string().optional().nullable(),
  deliveryCoordinatorName: z.string().optional().nullable(),
  deliveryCoordinatorPhone: z.string().optional().nullable(),
  grades: z
    .array(
      z.object({
        gradeOrBand: z.string(),
        expectedStudents: z.number().int().nonnegative(),
        sectionNames: z.string().optional().nullable(),
      }),
    )
    .default([]),
});

export const assignmentSchema = z.object({
  personId: z.string().uuid(),
  assignmentRole: z.enum(ASSIGNMENT_ROLES),
  travelRequired: z.boolean().default(false),
  travelDateOut: z.string().optional().nullable(),
  travelDateReturn: z.string().optional().nullable(),
});

export const deliveryReportSchema = z.object({
  workshopId: z.string().uuid(),
  actualDate: z.string(),
  teachersEngaged: z.number().int().nonnegative().default(0),
  sessionsConducted: z.number().int().nonnegative().default(1),
  batchesConducted: z.number().int().nonnegative().default(1),
  totalDurationMinutes: z.number().int().nonnegative().default(60),
  whatWorked: z.string().max(200).optional().nullable(),
  whatToImprove: z.string().max(200).optional().nullable(),
  feedbackScore: z.number().int().min(1).max(5).optional().nullable(),
  gradeActuals: z.array(
    z.object({
      gradeBreakdownId: z.string().uuid(),
      actualStudents: z.number().int().nonnegative(),
    }),
  ),
});

export const clientSchema = z.object({
  name: z.string().min(2),
  clientType: z.enum(CLIENT_TYPES),
  city: z.string().min(1),
  state: z.string().min(1),
  branch: z.string().optional().nullable(),
  board: z
    .enum(['CBSE', 'ICSE', 'State', 'Other', 'Not applicable'])
    .default('Not applicable'),
  contactPerson: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z
    .union([z.string().email(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v)),
  source: z.string().optional().nullable(),
});

export const programSchema = z.object({
  name: z.string().min(2),
  programFamily: z.enum(PROGRAM_FAMILIES),
  audience: z.enum(AUDIENCES),
  deliveryModeSupported: z.enum(['online', 'offline', 'both']).default('both'),
  defaultPrice: z.number().nonnegative().optional().nullable(),
  priceUnit: z.string().optional().nullable(),
  mapsToWorkshopCategory: z.enum(WORKSHOP_CATEGORIES).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const opportunitySchema = z.object({
  clientId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  decisionMakerContactId: z.string().uuid().optional().nullable(),
  coordinatorContactId: z.string().uuid().optional().nullable(),
  programId: z.string().uuid(),
  leadSource: z.enum(LEAD_SOURCES).default('outbound'),
  probability: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]).default(25),
  expectedValue: z.number().nonnegative().default(0),
  quotedValue: z.number().nonnegative().optional().nullable(),
  expectedStudents: z.number().int().nonnegative().optional().nullable(),
  expectedRegistrations: z.number().int().nonnegative().optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  expectedDeliveryWindowStart: z.string().optional().nullable(),
  expectedDeliveryWindowEnd: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  productConfig: z.record(z.unknown()).optional().nullable(),
  priorOpportunityId: z.string().uuid().optional().nullable(),
  stage: z.enum(OPPORTUNITY_STAGES).default('lead'),
  overrideConflict: z.boolean().optional(),
  overrideReason: z.string().optional().nullable(),
});

export const opportunityPatchSchema = opportunitySchema.partial().extend({
  proposalStatus: z.enum(PROPOSAL_STATUSES).optional(),
  proposalAmount: z.number().nonnegative().optional().nullable(),
  markProposalSent: z.boolean().optional(),
  onHoldReason: z.string().optional().nullable(),
  onHoldReopenMonth: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
  actualValue: z.number().nonnegative().optional().nullable(),
});

export const interactionSchema = z.object({
  opportunityId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  communicationMode: z.enum(COMMUNICATION_MODES),
  interactionType: z.enum(INTERACTION_TYPES),
  outcome: z.enum(INTERACTION_OUTCOMES),
  notes: z.string().min(1),
  nextAction: z.string().optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
  stageAfter: z.enum(OPPORTUNITY_STAGES).optional().nullable(),
});

export const contactSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(2),
  designation: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  email: z
    .union([z.string().email(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v)),
  contactRole: z.enum(CONTACT_ROLES).default('other'),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export const salesUnavailabilitySchema = z.object({
  startDateTime: z.string().min(1),
  endDateTime: z.string().min(1),
  reason: z.string().min(3),
});

export const nilReportSchema = z.object({
  date: z.string().min(1),
  reason: z.string().min(10),
});

export const shortAbsenceSchema = z.object({
  date: z.string(),
  category: z.enum(['official_work', 'personal']),
  reason: z.string().min(20),
  expectedOutTime: z.string(),
  expectedDurationMinutes: z.number().int().positive(),
  wasRetrospective: z.boolean().default(false),
});

export const correctionRequestSchema = z.object({
  tableName: z.string(),
  recordId: z.string().uuid(),
  fieldName: z.string(),
  currentValue: z.string(),
  proposedValue: z.string(),
  reason: z.string().min(20),
});

export const backdateRequestSchema = z.object({
  tableName: z.string(),
  targetDate: z.string(),
  recordPayload: z.record(z.unknown()),
  reason: z.string().min(20),
});

export const policyRuleUpdateSchema = z.object({
  ruleValue: z.string(),
  effectiveFrom: z.string().optional(),
  description: z.string().optional(),
});
