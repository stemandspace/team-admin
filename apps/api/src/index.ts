import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import { prisma } from '@team-admin/db';
import { authRouter } from './routes/auth';
import { peopleRouter } from './routes/people';
import { attendanceRouter } from './routes/attendance';
import { leaveRouter } from './routes/leave';
import { workshopsRouter } from './routes/workshops';
import { clientsRouter } from './routes/clients';
import { policyRouter } from './routes/policy';
import { holidaysRouter } from './routes/holidays';
import { complianceRouter } from './routes/compliance';
import { salesRouter } from './routes/sales';
import { tripsRouter } from './routes/trips';
import { dashboardRouter } from './routes/dashboard';
import { notificationsRouter } from './routes/notifications';
import { analyticsRouter } from './routes/analytics';
import { compensationRouter } from './routes/compensation';
import { engagementsRouter } from './routes/engagements';
import { errorHandler } from './middleware/error';

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required in production');
  process.exit(1);
}

if (isProd && !process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is required in production');
  process.exit(1);
}

const app = express();
// Railway injects PORT; keep API_PORT for local overrides
const port = Number(process.env.PORT || process.env.API_PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.set('trust proxy', 1);
app.use('/uploads', express.static(uploadDir));

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      db: true,
      time: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      db: false,
      time: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'database unavailable',
    });
  }
});

app.use('/auth', authRouter);
app.use('/people', peopleRouter);
app.use('/attendance', attendanceRouter);
app.use('/leave', leaveRouter);
app.use('/workshops', workshopsRouter);
app.use('/clients', clientsRouter);
app.use('/policy', policyRouter);
app.use('/holidays', holidaysRouter);
app.use('/compliance', complianceRouter);
app.use('/sales', salesRouter);
app.use('/trips', tripsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/notifications', notificationsRouter);
app.use('/analytics', analyticsRouter);
app.use('/compensation', compensationRouter);
app.use('/engagements', engagementsRouter);

app.use(errorHandler);

const server = app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down…`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
