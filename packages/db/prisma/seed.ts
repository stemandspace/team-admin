import { PrismaClient, Team, Role, LeaveType, ProgramFamily, Audience, WorkshopCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_POLICY_RULES = [
  { ruleKey: 'sandwich_leave_enabled', ruleValue: 'true', description: 'Count holidays between leave days' },
  { ruleKey: 'comp_off_expiry_days', ruleValue: '90', description: 'Days until comp-off expires' },
  { ruleKey: 'comp_off_sunday_delivery', ruleValue: 'full', description: 'full or half' },
  { ruleKey: 'comp_off_sunday_travel', ruleValue: 'half', description: 'full or half' },
  { ruleKey: 'comp_off_expiry_behaviour', ruleValue: 'lapse', description: 'lapse or auto-encash' },
  { ruleKey: 'casual_leave_annual', ruleValue: '12', description: 'Annual casual leave days' },
  { ruleKey: 'sick_leave_annual', ruleValue: '12', description: 'Annual sick leave days' },
  { ruleKey: 'earned_leave_annual', ruleValue: '15', description: 'Annual earned leave days' },
  { ruleKey: 'half_day_threshold_hours', ruleValue: '4', description: 'Hours below which half day applies' },
  { ruleKey: 'grace_minutes', ruleValue: '15', description: 'Late grace period' },
  { ruleKey: 'consecutive_late_alert', ruleValue: '3', description: 'Consecutive lates before alert' },
  { ruleKey: 'consecutive_late_penalty', ruleValue: '4', description: 'Consecutive lates before half-day deduction' },
  { ruleKey: 'late_penalty_days', ruleValue: '0.5', description: 'Days deducted on late penalty' },
  { ruleKey: 'monthly_late_threshold', ruleValue: '6', description: 'Monthly late count triggering deduction' },
  { ruleKey: 'personal_absence_free_minutes_monthly', ruleValue: '120', description: 'Free personal step-out minutes/month' },
  { ruleKey: 'personal_absence_deduction_threshold_minutes', ruleValue: '240', description: 'Minutes before half-day deduction' },
  { ruleKey: 'overtime_threshold_time', ruleValue: '18:30', description: 'Extra hours start after this time' },
  { ruleKey: 'days_divisor', ruleValue: '26', description: 'Working days divisor for daily salary' },
  { ruleKey: 'travel_day_allowance', ruleValue: '0', description: 'Allowance for outstation travel on working day' },
  { ruleKey: 'engagement_target_monthly', ruleValue: '400', description: 'Monthly paid students engaged target' },
  { ruleKey: 'incentive_enabled', ruleValue: 'false', description: 'Show projected incentive' },
  { ruleKey: 'dormancy_threshold_days', ruleValue: '90', description: 'Days without interaction before dormant' },
  { ruleKey: 'staffing_students_per_educator', ruleValue: '60', description: 'Norm students per educator' },
  { ruleKey: 'credit_weight_enabled', ruleValue: 'false', description: 'Credit attribution enabled when matrix set' },
  { ruleKey: 'credit_weight_primary_educator', ruleValue: '1', description: 'Credit weight' },
  { ruleKey: 'credit_weight_secondary_educator', ruleValue: '0.5', description: 'Credit weight' },
  { ruleKey: 'credit_weight_primary_support', ruleValue: '0.25', description: 'Credit weight' },
  { ruleKey: 'credit_weight_secondary_support', ruleValue: '0.25', description: 'Credit weight' },
  { ruleKey: 'credit_weight_trainee', ruleValue: '0', description: 'Credit weight' },
  { ruleKey: 'credit_weight_observer', ruleValue: '0', description: 'Credit weight' },
];

async function main() {
  for (const rule of DEFAULT_POLICY_RULES) {
    const existing = await prisma.policyRule.findFirst({
      where: { ruleKey: rule.ruleKey },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!existing) {
      await prisma.policyRule.create({
        data: {
          ruleKey: rule.ruleKey,
          ruleValue: rule.ruleValue,
          description: rule.description,
          effectiveFrom: new Date(),
        },
      });
    }
  }

  const email = process.env.SEED_OWNER_EMAIL || 'owner@stemandspace.com';
  const password = process.env.SEED_OWNER_PASSWORD || 'Owner123!';
  const hash = await bcrypt.hash(password, 10);

  const owner = await prisma.person.upsert({
    where: { email },
    update: {},
    create: {
      fullName: 'System Owner',
      employeeCode: 'OWN001',
      email,
      phone: '9999999999',
      passwordHash: hash,
      team: Team.support,
      role: Role.owner,
      baseCity: 'Pune',
      dateOfJoining: new Date('2020-01-01'),
      isActive: true,
    },
  });

  const year = new Date().getFullYear();
  for (const leaveType of [LeaveType.casual, LeaveType.sick, LeaveType.earned]) {
    const annual =
      leaveType === LeaveType.casual ? 12 : leaveType === LeaveType.sick ? 12 : 15;
    await prisma.leaveBalance.upsert({
      where: {
        personId_year_leaveType: {
          personId: owner.id,
          year,
          leaveType,
        },
      },
      update: {},
      create: {
        personId: owner.id,
        year,
        leaveType,
        openingBalance: annual,
        accrued: annual,
        taken: 0,
        balance: annual,
      },
    });
  }

  await prisma.shiftConfig.createMany({
    data: [
      {
        team: Team.sales,
        expectedStartTime: '09:30',
        expectedEndTime: '18:00',
        graceMinutes: 15,
        effectiveFrom: new Date(),
      },
      {
        team: Team.academic,
        expectedStartTime: '09:30',
        expectedEndTime: '18:00',
        graceMinutes: 15,
        effectiveFrom: new Date(),
      },
      {
        team: Team.support,
        expectedStartTime: '09:30',
        expectedEndTime: '18:00',
        graceMinutes: 15,
        effectiveFrom: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  const programs = [
    { name: 'Workshop–Schools', programFamily: ProgramFamily.workshop, audience: Audience.school, mapsToWorkshopCategory: WorkshopCategory.school_paid, defaultPrice: null as number | null, priceUnit: 'per student' },
    { name: 'Workshop–Retail', programFamily: ProgramFamily.workshop, audience: Audience.retail_direct_parent, mapsToWorkshopCategory: WorkshopCategory.retail_paid, defaultPrice: null, priceUnit: 'per student' },
    { name: 'IASC–Schools', programFamily: ProgramFamily.iasc, audience: Audience.school, mapsToWorkshopCategory: WorkshopCategory.school_paid, defaultPrice: 2000, priceUnit: 'per registration' },
    { name: 'IASC–Direct', programFamily: ProgramFamily.iasc, audience: Audience.retail_direct_parent, mapsToWorkshopCategory: WorkshopCategory.retail_paid, defaultPrice: 2000, priceUnit: 'per registration' },
    { name: 'NAC–Schools', programFamily: ProgramFamily.nac, audience: Audience.school, mapsToWorkshopCategory: WorkshopCategory.school_paid, defaultPrice: 300, priceUnit: 'per participant' },
    { name: 'NAC–Direct', programFamily: ProgramFamily.nac, audience: Audience.retail_direct_parent, mapsToWorkshopCategory: WorkshopCategory.retail_paid, defaultPrice: 500, priceUnit: 'per participant' },
    { name: 'Explorium–Schools', programFamily: ProgramFamily.explorium, audience: Audience.school, mapsToWorkshopCategory: WorkshopCategory.school_paid, defaultPrice: 499, priceUnit: 'per book/pack' },
    { name: 'Explorium–Direct', programFamily: ProgramFamily.explorium, audience: Audience.retail_direct_parent, mapsToWorkshopCategory: WorkshopCategory.retail_paid, defaultPrice: 499, priceUnit: 'per book/pack' },
  ];

  for (const p of programs) {
    const exists = await prisma.program.findFirst({ where: { name: p.name } });
    if (!exists) {
      await prisma.program.create({
        data: {
          name: p.name,
          programFamily: p.programFamily,
          audience: p.audience,
          mapsToWorkshopCategory: p.mapsToWorkshopCategory,
          defaultPrice: p.defaultPrice,
          priceUnit: p.priceUnit,
          deliveryModeSupported: 'both',
          isActive: true,
          effectiveFrom: new Date(),
        },
      });
    }
  }

  // CRM policy keys
  const crmPolicies = [
    { ruleKey: 'dormancy_threshold_days', ruleValue: '60', description: 'Days without qualifying activity before dead' },
    { ruleKey: 'sales_ageing_warning_days', ruleValue: '45', description: 'Warn before 60-day dead ageing' },
    { ruleKey: 'school_workshop_min_students', ruleValue: '150', description: 'School workshop commercial-risk threshold' },
    { ruleKey: 'workshop_online_min_per_student', ruleValue: '550', description: 'Online workshop red-alert ₹/student' },
    { ruleKey: 'workshop_offline_min_per_student', ruleValue: '700', description: 'Offline workshop red-alert ₹/student' },
    { ruleKey: 'iasc_price_per_registration', ruleValue: '2000', description: 'IASC fixed price' },
    { ruleKey: 'nac_school_price', ruleValue: '300', description: 'NAC school price' },
    { ruleKey: 'nac_direct_price', ruleValue: '500', description: 'NAC direct price' },
  ];
  for (const rule of crmPolicies) {
    const existing = await prisma.policyRule.findFirst({ where: { ruleKey: rule.ruleKey } });
    if (!existing) {
      await prisma.policyRule.create({
        data: { ...rule, effectiveFrom: new Date() },
      });
    }
  }

  // Demo staff for each team
  const demoUsers = [
    { fullName: 'Asha Sales', employeeCode: 'SAL001', email: 'sales@stemandspace.com', team: Team.sales, role: Role.employee },
    { fullName: 'Ravi Academic', employeeCode: 'ACA001', email: 'academic@stemandspace.com', team: Team.academic, role: Role.employee },
    { fullName: 'Neha Support', employeeCode: 'SUP001', email: 'support@stemandspace.com', team: Team.support, role: Role.employee },
    { fullName: 'Admin User', employeeCode: 'ADM001', email: 'admin@stemandspace.com', team: Team.support, role: Role.administrator },
  ];

  const demoHash = await bcrypt.hash('Demo123!', 10);
  for (const u of demoUsers) {
    const person = await prisma.person.upsert({
      where: { email: u.email },
      update: {},
      create: {
        ...u,
        passwordHash: demoHash,
        baseCity: 'Pune',
        dateOfJoining: new Date('2023-01-01'),
        isActive: true,
        reportsToId: owner.id,
      },
    });
    for (const leaveType of [LeaveType.casual, LeaveType.sick, LeaveType.earned]) {
      const annual =
        leaveType === LeaveType.casual ? 12 : leaveType === LeaveType.sick ? 12 : 15;
      await prisma.leaveBalance.upsert({
        where: {
          personId_year_leaveType: { personId: person.id, year, leaveType },
        },
        update: {},
        create: {
          personId: person.id,
          year,
          leaveType,
          openingBalance: annual,
          accrued: annual,
          taken: 0,
          balance: annual,
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log(`Owner: ${email} / ${password}`);
  console.log('Demo users password: Demo123!');
  console.log('  sales@stemandspace.com, academic@stemandspace.com, support@stemandspace.com, admin@stemandspace.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
