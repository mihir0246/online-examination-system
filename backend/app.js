import dotenv from 'dotenv';
import * as Sentry from "@sentry/node";
dotenv.config();

// ── Guard: suppress Bull/bluebird AbortErrors when Redis is unavailable ──────
// Bull uses bluebird internally; when Redis is down, BRPOPLPUSH throws an
// AbortError with code NR_CLOSED which escapes as an unhandledRejection.
// We catch it here so the server keeps running without Redis.
process.on('unhandledRejection', (reason, promise) => {
  const msg = reason?.message || '';
  const code = reason?.code || '';
  if (
    code === 'NR_CLOSED' ||
    msg.includes("can't be processed") ||
    msg.includes('connection is already closed') ||
    msg.includes('BRPOPLPUSH')
  ) {
    // Silently ignore — Bull/Redis offline, non-fatal
    return;
  }
  // For all other unhandled rejections: log and let Sentry capture them
  console.error('[UnhandledRejection]', reason);
  Sentry.captureException(reason);
});

import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { doubleCsrf } from "csrf-csrf";
import { createServer } from "http";


import passport from "./services/passportconf.js";
import { init as initSocket } from "./services/socket.js";
import logger from "./services/logger.js";
import { requireRole } from "./middleware/rbac.js";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redisClient from "./services/redis.js";

// Routes
import admin from "./routes/admin.js";
import login from "./routes/login.js";
import user from "./routes/user.js";
import universal from "./routes/universal.js";
import question from "./routes/questions.js";
import testpaper from "./routes/testpaper.js";
import up from "./routes/fileUpload.js";
import stopRegistration from "./routes/stopRegistration.js";
import trainee from "./routes/trainee.js";
import results from "./routes/results.js";
import healthRouter from "./routes/health.js";

// Initialise Bull workers (registers all queue processors at startup)
import "./services/worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const app = express();
const httpServer = createServer(app);

// Trust the first proxy hop (AWS ALB / Amplify)
app.set('trust proxy', 1);

// Sentry initialization handled by instrument.js

// Initialize Socket.io
initSocket(httpServer);

// Prisma manages its own MongoDB connection pool via DATABASE_URL
logger.info("🍃 Prisma client initialized — MongoDB connection managed by Prisma");

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Modern CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  credentials: true,
}));

import { auditLog, AuditEvent } from "./services/auditLog.js";

// Rate Limiters — graceful fallback to in-memory store when Redis is unavailable
function createRedisStore() {
  if (redisClient.status === 'ready') {
    return new RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
  }
  return undefined;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  ...(redisClient.status === 'ready' && { store: createRedisStore() }),
  handler: async (req, res, next, options) => {
    await auditLog({ 
      event: AuditEvent.RATE_LIMIT_HIT, 
      ip: req.ip,
      metadata: { route: req.path }
    });
    res.status(429).json({ success: false, message: options.message });
  },
  message: 'Too many login attempts, please try again later.'
});

// CSRF Protection
const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "supersecret", 
  cookieName: "x-csrf-token",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === 'production',
    path: "/",
  },
  getTokenFromRequest: (req) => req.headers["x-csrf-token"],
  getSessionIdentifier: (req) => {
    if (req.user?.id) return req.user.id;
    return req.ip || "anonymous";
  },
});

app.get("/api/v1/csrf-token", (req, res) => {
  res.json({ token: generateCsrfToken(req, res) });
});

// Passport
app.use(passport.initialize());

// Server-side Clock Sync Middleware
app.use((req, res, next) => {
  res.setHeader('X-Server-Time', new Date().toISOString());
  next();
});

import audit from "./routes/audit.js";

// Plan 3.5: RBAC applied — ADMIN-only for user/admin management, TRAINER|ADMIN for test ops
app.use("/api/v1/admin", doubleCsrfProtection, passport.authenticate('user-token', { session: false }), requireRole('ADMIN'), admin);
app.use("/api/v1/user", doubleCsrfProtection, passport.authenticate('user-token', { session: false }), requireRole('ADMIN'), user);
app.use('/api/v1/subject', passport.authenticate('user-token', { session: false }), universal);
app.use('/api/v1/questions', passport.authenticate('user-token', { session: false }), question);
app.use('/api/v1/test', passport.authenticate('user-token', { session: false }), requireRole('ADMIN', 'TRAINER'), testpaper);
app.use('/api/v1/upload', passport.authenticate('user-token', { session: false }), up);
app.use('/api/v1/trainer', passport.authenticate('user-token', { session: false }), stopRegistration);
app.use('/api/v1/trainee', trainee);
app.use('/api/v1/final', doubleCsrfProtection, passport.authenticate('user-token', { session: false }), requireRole('ADMIN', 'TRAINER'), results);
app.use('/api/v1/login', loginLimiter, doubleCsrfProtection, login);
app.use('/api/v1/audit', doubleCsrfProtection, passport.authenticate('user-token', { session: false }), requireRole('ADMIN', 'TRAINER'), audit);

app.get('/api/v1/time', (req, res) => {
  res.status(200).json({ serverTime: new Date().toISOString() });
});

// Deep health check (DB + Redis + Queue status)
app.use('/health', healthRouter);

app.get("/debug-sentry", function mainHandler(req, res) {
  Sentry.metrics.increment("test_counter", 1);
  throw new Error("My first Sentry error!");
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Global Error Handler
app.use((req, res, next) => {
  const error = new Error("Invalid API Endpoint");
  error.status = 404;
  next(error);
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  logger.error(`[${status}] ${req.method} ${req.url} - ${err.message}\n${err.stack}`);
  
  res.status(status).json({
    success: false,
    message: status === 500 ? "Internal Server Error" : err.message,
    // Avoid leaking stack trace in production
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server Modernized (ESM) & Started on port ${PORT}`);
});
