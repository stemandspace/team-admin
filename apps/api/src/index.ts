import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
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

const app = express();
const port = Number(process.env.API_PORT || 4000);
const uploadDir = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
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

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
