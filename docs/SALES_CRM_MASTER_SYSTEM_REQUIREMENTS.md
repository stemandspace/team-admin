# SALES CRM — MASTER SYSTEM REQUIREMENTS DOCUMENT

**FINAL / REVISED / LOCKED**

**School + Retail/Parent | Workshop + IASC + National Astronomy Challenge + Explorium**

This is the master business/product system-requirements document. It defines what the Sales CRM must do and intentionally excludes technical database, API, coding and implementation structure.

---

## 1. Purpose, Scope & Product Principles

- Replace the existing Excel sales MIS with one CRM for School and Retail/Parent sales.
- Corporate sales is out of scope; Community/direct consumer business is treated as Retail.
- Manage the full journey from lead through qualification, proposal, follow-up, closure, transaction, relationship ownership, attribution, targets, achievement and reporting.
- Support current products while allowing future products and packages to be added without changing the fundamental sales journey.
- Release 1 has two active roles: **Salesperson** and **Owner**. Administrator is not required now and may be introduced later as a delegated role.
- The CRM is a shared sales-visibility system, not a private personal lead-management system.

---

## 2. Shared Sales Visibility & Common Sales Activity Feed

- Every salesperson can see relevant commercial activity of other salespeople to prevent duplicate or consciously overlapping outreach.
- Salespeople can see which schools/branches have been approached, which parents have been contacted, the product discussed, date of activity, current stage and next follow-up.
- Visibility does not give editing or ownership rights. A salesperson cannot edit, close, reassign or delete another salesperson's records.
- A single automatically populated Sales Activity Feed covers Workshop, IASC, NAC and Explorium across School and Retail.
- Meaningful events populate automatically: new lead, contact, conversation, follow-up, product/opportunity activity, proposal sent/revised, stage change, registration, order, Won/Lost/On Hold and ownership events.
- Feed should show date, salesperson, customer/school, branch where relevant, channel, product, activity, stage and next action.
- Filters should include salesperson, channel, product, activity type, date period, city/school; search should work by school, parent, contact or phone.
- Salespeople do not maintain a second manual consolidated log. The feed is generated from normal CRM activity.
- A separate Owner-level audit history is retained for compliance and system actions.

---

## 3. School Account & Contact Requirements

- Capture complete official school name, city and branch.
- Do not use abbreviations. Example: Delhi Public School, not DPS. Poor-quality abbreviated names should be warned against or prevented.
- Different branches are separate sales relationships.
- Each school opportunity requires a Decision Maker and Coordinator/Second Contact with name, designation, phone number and email ID.
- A school opportunity cannot proceed until the required contacts are captured.
- Board information may be captured where relevant.

---

## 4. Retail Customer Requirements

- Capture parent/customer name and phone number, plus email and city where available.
- Retail customer identity persists after salesperson ownership expires; ownership changes do not create duplicate customer records.

---

## 5. Lead Source, Communication & Interaction

- Lead Source and Communication Channel are separate.
- Lead Source: Inbound or Outbound.
- Communication Channel may include Phone, WhatsApp, WhatsApp Call, Email, In-person, Zoom and future approved channels.
- For every genuine interaction, record what was discussed, outcome and next action.
- Unanswered/unreachable calls and cancelled/non-occurring meetings are not completed interactions.

---

## 6. Duplicate & Conflict Prevention

- Before creating a lead, check whether the school/customer already exists.
- School matching considers name, city, branch and relevant contacts; retail matching uses available phone, email and name.
- If another salesperson is already working the relationship, the new salesperson sees the existing activity and cannot create a competing duplicate.
- Legitimate new product/contact activity may be added where appropriate; Owner handles conflicts and overrides with a reason.
- Expired relationships can be approached again through a new opportunity while preserving history.

---

## 7. Product — Workshop

- Online or Offline; 60 or 90 minutes; 1–5 workshops.
- School grade clusters: Junior Grades 2–3; Middle Grades 4–6; Senior Grades 7–9. Actual grades can be selected within a cluster.
- Capture workshop name and student count for each selected cluster.
- A school may buy one cluster, multiple clusters or a combination of workshops.
- Commercial model may be per student or fixed price; expected, quoted and actual value are distinct.
- Retail Workshop uses the same product configuration but is exempt from the school 150-student benchmark.

---

## 8. Workshop Commercial Alerts

- School workshop below 150 students is a commercial-risk alert.
- Online below ₹550/student is a red alert.
- Offline below ₹700/student is a red alert.
- Alerts never block a deal; management reporting must highlight them.

---

## 9. Product — IASC Citizen Science Project

- School or direct parent route. School may use website registration or Excel; direct uses website.
- ₹2,000 per registration, fixed; no discount; no minimum or maximum.
- One completed registration is one sale.
- Expected registrations/value are forecast; achievement uses actual registrations.
- The school receives no commercial benefit; students participate and receive training/programme access.

---

## 10. Product — National Astronomy Challenge

- School or direct/retail route. School may use website or Excel; direct uses website.
- School price ₹250 or ₹300 pending final business decision; once confirmed, universal. Direct price ₹500.
- No discount, minimum or maximum.
- One registered participant is one sale.
- ₹50,000 is an ownership-duration threshold only, not a minimum order.

---

## 11. Product — Explorium

- School or direct parent route.
- Single Book ₹499; Three-Book Pack ₹999; no discount.
- Catalogue must support future books, packs and bundles without changing the core sales process.

---

## 12. Common Opportunity Lifecycle

- Lead → Duplicate/Ownership Check → Contact → Product → Requirements → Expected Quantity/Value → Sales Conversion → Proposal Sent → Follow-up → Probability → Expected Closure → Won/Lost/On Hold → Transaction/Registration/Order → Ownership → Attribution.
- Probability is 25%, 50%, 75% or 100%.
- Weighted Pipeline = Expected Value × Probability.
- Expected closure date is separate from delivery, participation or fulfilment date.

---

## 13. Proposal Tracking — No Approval

- There is no proposal approval workflow. Salespeople may send proposals directly.
- When a proposal is sent, capture Proposal Sent, Proposal Sent Date, Proposal Amount and Proposal Status.
- Proposal Sent Date should be captured with minimal effort, preferably automatically when the salesperson marks the proposal as sent.
- No proposal sending time is required.
- Material revisions remain traceable. Client response, negotiation, follow-up and Won/Lost remain part of the opportunity.

---

## 14. Follow-up, Meaningful Activity & 60-Day Ageing

- Every follow-up records what happened, outcome and next action.
- Only meaningful commercial movement resets the ageing clock: genuine conversation, requirement change, commercial/price discussion, proposal sent/revised, negotiation, client decision, client-confirmed next step, material quantity change, registration/order activity or equivalent movement.
- Reminders, internal discussions, proposal preparation, probability-only changes, duplicate notes, unanswered calls and cancelled meetings do not reset ageing by themselves.
- No qualifying commercial movement for 60 days = Lost/Dead. Warnings should appear before the deadline.
- On Hold requires a reason and expected reopen month; ageing continues.
- After an opportunity becomes dead, a later approach creates a new opportunity linked to the prior history.

---

## 15. School Relationship Ownership

- Inactive/unconverted lead: 60 days.
- Closed Workshop: 1 year.
- Closed IASC: 6 months; another IASC closure during active ownership renews 6 months from the latest qualifying closure.
- IASC followed by Workshop gives 1 year from Workshop closure; later Workshop closure renews 1 year.
- NAC below ₹50,000: 6 months; NAC ₹50,000 or more: 1 year.
- ₹50,000 is an ownership-duration threshold, not a minimum order.
- Explorium follows common rules until separately decided.
- Ownership is based on the latest qualifying event and is not stacked.

---

## 16. Retail Ownership & Attribution

- Retail ownership lasts 90 days from the latest qualifying purchase.
- No repeat within 90 days opens the customer to another salesperson; a qualifying repeat renews 90 days.
- Ownership and attribution are separate.
- For school-originated retail, retain the source school/branch and originating school salesperson according to the agreed attribution rule, while also recording the salesperson who handled the retail transaction.
- One transaction has one primary credited salesperson; historical credit is never silently rewritten.

---

## 17. Closure, Achievement, Cancellation & Refund

- Workshop achievement = actual closed value. IASC/NAC = actual registration value. Explorium = actual order value.
- Historical price charged remains attached to the historical transaction.
- Cancellation/refund creates a separate achievement adjustment/reversal with reason and date; original transaction and attribution remain unchanged.

---

## 18. Targets & Performance

- Every salesperson has monthly and quarterly targets.
- Targets may be overall or product-specific and may be value, registration-count or new-school-count targets.
- Core performance view: Target → Achievement → Pipeline → Weighted Pipeline → Projected Achievement.
- Working days and leave days are shown as context; no automatic target proration in Release 1.

---

## 19. Salesperson Dashboard

- Today, This Month, Last Month, This Quarter, Last Quarter, YTD and FY.
- Target, achievement, balance and achievement percentage.
- Active/stage/weighted/future pipeline; product-wise; School vs Retail; New vs Existing School.
- Retail leads, likely closures, Won/Lost/On Hold, pipeline and retail target contribution.
- Follow-ups, proposals, commercial alerts, ownership expiry and daily reporting/availability compliance.

---

## 20. Management Dashboard

- Overall target, achievement, pipeline, weighted pipeline, future pipeline and projected achievement.
- Salesperson comparison; product and channel split.
- New vs Existing School acquisition/revenue.
- Retail volume, conversion, pipeline and contribution.
- Ageing, ownership expiry, commercial alerts and daily reporting/leave/availability compliance.

---

## 21. New vs Existing School Health

- First-ever closed business from a school = New School; subsequent closed business = Existing/Repeat.
- Show new schools, repeat schools, new/repeat revenue, repeat deals, schools without repeat business, deals per school, average deal value and annual revenue per active school.
- Make it easy to see whether a salesperson is generating new business or relying on existing relationships.

---

## 22. Reporting & Exports

- Daily, 15-Day, Monthly, Quarterly, 6-Month, Yearly and Custom.
- Include lead source, conversion, proposals, follow-ups, Won/Lost/On Hold, value, registrations/participants, product mix, School/Retail, New/Existing, future pipeline, ageing, alerts, ownership, attribution and availability/leave.
- Downloadable as PDF and Excel.
- Every export is recorded in audit history.

---

## 23. Leave / Unavailability — Sales Discipline Feature

- A salesperson can apply for Leave/Unavailability directly inside the CRM.
- Leave is not limited to full day or half day. It can cover any required period, including 1 hour, 2 hours, several hours, half day, full day or multiple days.
- The request captures start date/time, end date/time and reason. The reason is required.
- Leave request status is Pending → Approved or Rejected.
- Owner receives an in-system alert when a leave request is submitted and can approve or reject it within the CRM.
- Approved Leave/Unavailability automatically marks the approved period as unavailable for sales reporting.
- During an approved unavailable period, the salesperson is not expected to enter a normal sales record and should not receive a missing-record/blocking alert for that period.
- For partial-day unavailability, normal sales reporting is expected before and after the approved unavailable period.
- An approved leave period remains permanently visible in the person's daily/attendance history with the leave reason and approval status.
- A salesperson cannot use leave retrospectively simply to avoid a missing-record requirement. Past-period corrections require Owner intervention.
- Rejected leave does not remove the normal daily reporting obligation.
- Leave/Unavailability is a sales-discipline mechanism only. Leave balances, entitlements, payroll, comp-off, HR policies and other full HR functionality remain outside scope.

---

## 24. Daily Attendance & Sales Reporting

- Salespeople record punch-in and punch-out; this is sales discipline, not full HR.
- A working period with no qualifying client record is flagged and blocks later sales entry until addressed, except where an approved Leave/Unavailability period covers that time.
- Full-day approved leave, weekly off and holiday require no sales record.
- Half-day or hourly leave requires no sales record only for the approved unavailable period; the remaining working period follows normal reporting rules.
- A genuine no-contact working period may use a Nil Report with written reason; Nil Reports are separately counted.
- Unexplained absence with no punch-in and no approved leave/holiday is flagged to Owner.
- Daily analytics show raw activity counts, working-day trends, averages and breakdowns by channel, interaction type and outcome. Raw volume is never the sole performance measure.

---

## 25. Workshop Operational Sheet

- Closed school Workshops automatically appear in a lightweight operational sheet.
- Show school, city, planned date, closing salesperson, grade-wise students, educators/support, parallel sessions, status and remarks.
- Total students derive from grade-wise numbers. Manual rows can cover IASC training, teacher orientation and other programmes.
- No commercial values or pipeline stages. Cancellations require a reason and remain visible.

---

## 26. Owner Role — Release 1

- Owner is the ultimate administrator for Release 1.
- Owner manages assignment/reassignment, conflict overrides, ownership release, corrections/backdating, targets, product/pricing rules, dashboards, reports, compliance, audit, leave approval/rejection and salesperson access.
- Administrator is not an active Release 1 role and may be introduced later as a delegated role.

---

## 27. Compliance & History

- Submitted history cannot be silently edited or deleted by salespeople.
- Corrections/backdating use an approved process and preserve original history.
- No historical sales, ownership, attribution or approved leave history is hard-deleted.
- Reassignment does not rewrite historical achievement.
- Owner history records significant approvals, overrides, ownership changes, configuration changes, leave decisions and exports.

---

## 28. Handover & Notifications

- Salesperson deactivation never deletes history. Handover covers open opportunities, active relationships, pending proposals, follow-ups, registrations/orders and outstanding daily records.
- Open opportunities must be reassigned or formally closed; historical attribution remains unchanged.
- **Urgent alerts:** daily reporting block, opportunity nearing 60-day death, ownership expiring soon.
- **Action alerts:** follow-up due/overdue, client/proposal response, correction/backdate, transfer/reassignment, rejected Excel rows and pending leave requests.
- **Informational alerts:** duplicate attempt, commercial alert, target-period closing and newly unlocked relationship.

---

## 29. Excel Registration & Migration

- Applicable school products may use website or Excel.
- Excel validates required information and duplicates before acceptance and clearly shows rejected rows.
- Existing Excel MIS data is migrated through controlled validation; school names are cleaned/expanded and historical ownership established.
- Imported history remains distinguishable from post-launch activity.

---

## 30. Rules & Governance

- One Rules & Governance page explains naming, duplicate/conflict, ownership, ageing, proposal tracking, probability, On Hold, commercial alerts, pricing, retail ownership, attribution, daily reporting, Leave/Unavailability and compliance.
- When the CRM applies a rule or prevents an action, the user should be able to understand the governing rule.
- Current business-configurable values should be reflected in the page.

---

## 31. Release 1 Boundaries

- Full Workshop Management, educator allocation, capacity/availability and delivery reporting are outside this Sales CRM.
- Full HR functions such as leave balances, entitlements, comp-off, payroll, step-outs, lateness penalties, travel, reimbursements and conduct workflows are outside scope.
- Incentive calculation/payout, payment gateway integration and detailed workshop margin/head-wise costing are outside scope.
- Corporate sales is outside scope.

---

## 32. Core Product Principle

- The CRM should make sales transparent without creating unnecessary administrative burden.
- It should prevent duplicate effort, expose weak/ageing opportunities, flag below-benchmark deals without blocking them, distinguish pipeline from actual achievement, account for approved salesperson unavailability, and show whether salespeople generate new business or rely on existing relationships.
- All sales history, ownership, attribution and approved leave/availability history must remain trustworthy and auditable.

---

## MASTER SALES FLOW — BUSINESS VIEW

```
LEAD / CUSTOMER
↓
SCHOOL OR RETAIL
↓
DUPLICATE + OWNERSHIP CHECK
↓
CONTACT + LEAD SOURCE + COMMUNICATION
↓
PRODUCT
Workshop / IASC / NAC / Explorium
↓
PRODUCT-SPECIFIC REQUIREMENTS
↓
EXPECTED QUANTITY + VALUE
↓
SALES CONVERSION
↓
PROPOSAL SENT
Date + Amount + Status
↓
FOLLOW-UP / NEGOTIATION
↓
PROBABILITY
25% / 50% / 75% / 100%
↓
EXPECTED CLOSURE
↓
WON / LOST / ON HOLD
↓
SALE / ORDER / REGISTRATION
↓
ACHIEVEMENT + ATTRIBUTION
↓
RELATIONSHIP OWNERSHIP
↓
DASHBOARDS + REPORTING
```

### Ageing path

```
NO QUALIFYING COMMERCIAL MOVEMENT FOR 60 DAYS
↓
LOST / DEAD
↓
LATER APPROACH = NEW OPPORTUNITY WITH HISTORY LINKED
```

### Activity feed path

```
ALL MEANINGFUL SALES EVENTS
↓
COMMON SALES ACTIVITY FEED
↓
VISIBLE TO SALES TEAM
↓
DUPLICATE-EFFORT PREVENTION
```

### Leave path

```
LEAVE / UNAVAILABILITY REQUEST
↓
OWNER ALERT
↓
APPROVED / REJECTED
↓
IF APPROVED: NO SALES RECORD EXPECTED DURING APPROVED PERIOD
↓
NORMAL REPORTING BEFORE / AFTER PERIOD
```

---

This final document incorporates the latest locked decision that Leave/Unavailability can be requested for any period, including hourly periods, and approved/rejected by the Owner within the CRM. It intentionally contains no technical structure and no Administrator proposal-approval workflow.
