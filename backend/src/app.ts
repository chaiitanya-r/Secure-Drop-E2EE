import dotenv from 'dotenv';
dotenv.config();

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { filesRouter } from './routes/files.js';
import { publicShareRouter } from './routes/publicShare.js';
import { auditRouter } from './routes/audit.js';
import { createRateLimiters } from './security/rateLimiters.js';

const app = express();

app.use(helmet());
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : ['http://127.0.0.1:3000', 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'x-aes-iv', 'x-aes-tag', 'x-file-mime', 'x-encrypted-key']
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const { loginLimiter, uploadLimiter } = createRateLimiters();

app.use('/api/auth/login', loginLimiter);
app.use('/api/files/upload', uploadLimiter);

app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/public/share', publicShareRouter);
app.use('/api/audit', auditRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export { app };


