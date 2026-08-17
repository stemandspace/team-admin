# Workshop Operations System 1

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
| `npm run build:api` | Build shared + db + API for production |
| `npm run build:web` | Build shared + Next.js web for production |
| `npm run start:api` | Sync schema (`db push`) + start API |
| `npm run db:push` | Push Prisma schema |
| `npm run db:seed` | Seed policies, programs, demo users |
| `npm run db:generate` | Prisma client |

## Railway (API)

1. Create a Railway project with a **Postgres** plugin and an empty **service** for the API.
2. Connect this GitHub repo. Set:
   - **Root Directory**: `/`
   - **Builder**: Dockerfile
   - **Dockerfile path**: `apps/api/Dockerfile`  
   (or use the root `railway.toml`)
3. Variables (Variables tab):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Reference the Postgres `DATABASE_URL` (add `?sslmode=require` if missing) |
| `JWT_SECRET` | Long random string |
| `CORS_ORIGIN` | Your web origin(s), comma-separated |
| `NODE_ENV` | `production` |
| `UPLOAD_DIR` | `/tmp/uploads` (ephemeral; replace with object storage later) |

`PORT` and `HOST` are handled automatically.

4. After first deploy, run seed once (Railway shell or local against prod DB):

```bash
DATABASE_URL="…" npm run db:seed
```

5. Point the web app’s `NEXT_PUBLIC_API_URL` at the Railway API public URL (see Vercel below).

## Vercel (Web)

1. Import this GitHub repo in [Vercel](https://vercel.com).
2. Project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - Install/Build commands come from `apps/web/vercel.json` (monorepo install + `build:web`)
3. Environment variable (Production + Preview):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your Railway API public URL, e.g. `https://….up.railway.app` (no trailing slash) |

4. Deploy. Copy the Vercel URL (e.g. `https://team-admin.vercel.app`).
5. On Railway API, set:

```text
CORS_ORIGIN=https://team-admin.vercel.app,http://localhost:3000
```

Include preview URLs too if you use them (comma-separated). Redeploy the API after changing CORS.

6. Local web env: copy `apps/web/.env.example` → `apps/web/.env.local`.
