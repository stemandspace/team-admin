# Workshop Operations System

Internal ops platform for educational workshop organisations — **Attendance & Leave**, **Workshop Delivery**, and **Sales**, sharing one availability spine (`day_record`).

## Stack

- **Next.js** (`apps/web`) — mobile-first admin UI
- **Express** (`apps/api`) — JWT auth, business rules, server timestamps
- **PostgreSQL** (Railway) via **Prisma** (`packages/db`)
- **Shared** types/visibility/policy (`packages/shared`)

## Setup

1. Copy env files (already present locally; never commit secrets):

```bash
# packages/db/.env and apps/api/.env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/railway?sslmode=require
JWT_SECRET=long-random-string
```

2. Install and generate:

```bash
npm install
npm run db:generate
npm run build -w @team-admin/shared
```

3. Apply schema + seed (run on a machine that can reach Railway):

```bash
npm run db:push
npm run db:seed
```

4. Run:

```bash
npm run dev:api
npm run dev:web
```

- API: http://localhost:4000  
- Web: http://localhost:3000  

### Seed users

| Email | Password | Role |
|---|---|---|
| owner@stemandspace.com | Owner123! | Owner |
| admin@stemandspace.com | Demo123! | Administrator |
| sales@stemandspace.com | Demo123! | Sales employee |
| academic@stemandspace.com | Demo123! | Academic employee |
| support@stemandspace.com | Demo123! | Support employee |

## Architecture notes

- Visibility matrix enforced in Express middleware (academic/support cannot access commercial tables).
- Punches, interactions, submissions use **server clock only**.
- Locked records are not editable by employees — correction/backdate workflows only.
- Forecast revenue on `opportunities`; actual on `engagements.totalRevenueCollected`.
- Open-platform reach is never summed into students engaged.
- No Razorpay / margins / sales incentives yet (spec Section 15).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev:api` | Express API |
| `npm run dev:web` | Next.js UI |
| `npm run db:push` | Push Prisma schema |
| `npm run db:seed` | Seed policies, programs, demo users |
| `npm run db:generate` | Prisma client |
