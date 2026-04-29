import dotenv from 'dotenv';
dotenv.config();

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
import mongoose from 'mongoose';

import passport from "./services/passportconf.js";
import { init as initSocket } from "./services/socket.js";
import logger from "./services/logger.js";
import { requireRole } from "./middleware/rbac.js";
import { initSentry, sentryErrorHandler } from "./services/sentry.js";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const app = express();
const httpServer = createServer(app);

// Plan 4.1: Initialize Sentry error monitoring (no-op if SENTRY_DSN not set)
await initSentry(app);

// Initialize Socket.io
initSocket(httpServer);

// MongoDB Connection Tuning
const MONGO_URI = process.env.DATABASE_URL || process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  maxPoolSize: 100, // Tuned for high concurrency
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  family: 4, // Force IPv4 to avoid potential handshake issues
}).then(() => {
  logger.info("🍃 MongoDB Connected with tuned connection pool");
}).catch(err => {
  logger.error(`❌ MongoDB Connection Error: ${err.message}`);
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
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
  getSessionIdentifier: (req) => "fixed-session-id", 
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
app.use('/api/v1/login', doubleCsrfProtection, login);

// Health check & Time Sync
app.get('/api/v1/time', (req, res) => {
  res.status(200).json({ serverTime: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});

// Plan 4.1: Sentry error capture — must be BEFORE global error handler
app.use(sentryErrorHandler);

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
