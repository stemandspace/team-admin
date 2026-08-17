import {
  CRM_DEFAULTS,
  NON_COMPLETED_OUTCOMES,
  OPEN_OPPORTUNITY_STAGES,
  QUALIFYING_INTERACTION_TYPES,
  type ProgramFamily,
} from '@team-admin/shared';

export type CommercialAlert = {
  code: string;
  severity: 'warn' | 'red';
  message: string;
};

export type WorkshopProductConfig = {
  mode?: 'online' | 'offline';
  durationMinutes?: 60 | 90;
  workshopCount?: number;
  clusters?: Array<{
    clusterId: string;
    grades?: string[];
    workshopName?: string;
    studentCount?: number;
  }>;
  pricingModel?: 'per_student' | 'fixed';
};

export function normalizeSchoolName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bDPS\b/gi, 'Delhi Public School')
    .replace(/\bKV\b/gi, 'Kendriya Vidyalaya');
}

export function looksAbbreviatedSchoolName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 8) return true;
  if (/^[A-Z]{2,6}$/.test(trimmed)) return true;
  if (/\b(DPS|KV|SNS|ABC)\b/i.test(trimmed) && trimmed.split(/\s+/).length <= 2) {
    return true;
  }
  return false;
}

export function isQualifyingInteraction(
  interactionType: string,
  outcome: string,
): boolean {
  if ((NON_COMPLETED_OUTCOMES as readonly string[]).includes(outcome)) return false;
  return (QUALIFYING_INTERACTION_TYPES as readonly string[]).includes(interactionType);
}

export function isCompletedInteraction(outcome: string): boolean {
  return !(NON_COMPLETED_OUTCOMES as readonly string[]).includes(outcome);
}

export function weightedPipeline(expectedValue: number, probability: number): number {
  return (Number(expectedValue) || 0) * ((Number(probability) || 0) / 100);
}

export function computeWorkshopAlerts(input: {
  audience: string;
  expectedStudents?: number | null;
  expectedValue?: number | null;
  productConfig?: WorkshopProductConfig | null;
}): CommercialAlert[] {
  const alerts: CommercialAlert[] = [];
  const cfg = input.productConfig || {};
  const students = Number(input.expectedStudents || 0);
  const value = Number(input.expectedValue || 0);
  const isSchool = input.audience === 'school';

  if (isSchool && students > 0 && students < CRM_DEFAULTS.schoolWorkshopMinStudents) {
    alerts.push({
      code: 'below_150_students',
      severity: 'warn',
      message: `School workshop below ${CRM_DEFAULTS.schoolWorkshopMinStudents}-student benchmark (${students}).`,
    });
  }

  if (students > 0 && value > 0) {
    const per = value / students;
    if (cfg.mode === 'online' && per < CRM_DEFAULTS.onlineMinPerStudent) {
      alerts.push({
        code: 'online_price_red',
        severity: 'red',
        message: `Online below ₹${CRM_DEFAULTS.onlineMinPerStudent}/student (₹${Math.round(per)}).`,
      });
    }
    if (cfg.mode === 'offline' && per < CRM_DEFAULTS.offlineMinPerStudent) {
      alerts.push({
        code: 'offline_price_red',
        severity: 'red',
        message: `Offline below ₹${CRM_DEFAULTS.offlineMinPerStudent}/student (₹${Math.round(per)}).`,
      });
    }
  }

  return alerts;
}

export function ownershipDaysForWin(input: {
  programFamily: ProgramFamily | string;
  audience: string;
  actualValue: number;
}): number {
  const family = String(input.programFamily);
  if (input.audience === 'retail_direct_parent' || family === 'explorium') {
    return CRM_DEFAULTS.retailOwnershipDays;
  }
  if (family === 'workshop') return CRM_DEFAULTS.workshopOwnershipDays;
  if (family === 'iasc' || family === 'challenge') return CRM_DEFAULTS.iascOwnershipDays;
  if (family === 'nac' || family === 'olympiad') {
    return input.actualValue >= CRM_DEFAULTS.nacOwnershipThreshold
      ? CRM_DEFAULTS.nacOwnershipDaysHigh
      : CRM_DEFAULTS.nacOwnershipDaysLow;
  }
  return CRM_DEFAULTS.inactiveLeadOwnershipDays;
}

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function ageingStatus(lastQualifyingAt: Date | null | undefined, now = new Date()) {
  if (!lastQualifyingAt) {
    return { days: 0, warning: false, dead: false };
  }
  const days = Math.floor(
    (now.getTime() - new Date(lastQualifyingAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  return {
    days,
    warning: days >= CRM_DEFAULTS.ageingWarningDays && days < CRM_DEFAULTS.ageingDeadDays,
    dead: days >= CRM_DEFAULTS.ageingDeadDays,
  };
}

export function isOpenStage(stage: string): boolean {
  return (OPEN_OPPORTUNITY_STAGES as readonly string[]).includes(stage);
}

export const CRM_RULES_COPY = [
  {
    id: 'naming',
    title: 'School naming',
    body: 'Use the complete official school name (e.g. Delhi Public School), not abbreviations like DPS. Different branches are separate relationships.',
  },
  {
    id: 'duplicate',
    title: 'Duplicate & conflict',
    body: 'Before creating a lead, the CRM checks existing school/customer matches. If another salesperson already owns an open relationship, you can see their activity but cannot create a competing duplicate. Owner may override with a reason.',
  },
  {
    id: 'contacts',
    title: 'School contacts',
    body: 'School opportunities require a Decision Maker and a Coordinator/Second Contact (name, designation, phone, email) before advancing past Contact.',
  },
  {
    id: 'ageing',
    title: '60-day ageing',
    body: 'Only meaningful commercial movement resets ageing. No qualifying activity for 60 days marks the opportunity Lost/Dead. Warnings appear from day 45.',
  },
  {
    id: 'proposal',
    title: 'Proposal tracking',
    body: 'No approval workflow. Marking a proposal sent captures date, amount and status automatically.',
  },
  {
    id: 'probability',
    title: 'Probability & weighted pipeline',
    body: 'Probability is 25%, 50%, 75% or 100%. Weighted Pipeline = Expected Value × Probability.',
  },
  {
    id: 'alerts',
    title: 'Workshop commercial alerts',
    body: `School workshops below ${CRM_DEFAULTS.schoolWorkshopMinStudents} students warn. Online below ₹${CRM_DEFAULTS.onlineMinPerStudent}/student and offline below ₹${CRM_DEFAULTS.offlineMinPerStudent}/student are red alerts. Alerts never block a deal.`,
  },
  {
    id: 'ownership',
    title: 'Relationship ownership',
    body: 'Ownership duration depends on product (Workshop 1 year, IASC 6 months, NAC 6 months or 1 year at ₹50k+, Retail 90 days). Ownership is based on the latest qualifying event and is not stacked.',
  },
  {
    id: 'on_hold',
    title: 'On Hold',
    body: 'On Hold requires a reason and expected reopen month. Ageing continues while on hold.',
  },
  {
    id: 'leave',
    title: 'Leave / Unavailability',
    body: 'Salespeople can request leave for any period including hourly slots. Owner approves/rejects. Approved periods exempt daily sales reporting.',
  },
] as const;
